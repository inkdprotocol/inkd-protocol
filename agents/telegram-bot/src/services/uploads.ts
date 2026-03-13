import type { Context, SessionFlavor } from 'grammy'
import { InlineKeyboard } from 'grammy'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseRepoInput, fetchRepoDefaultBranch, downloadRepoZip } from './github'
import { getUploadPriceEstimate, type PriceEstimate } from './api'
import { getWalletFromEncrypted } from './wallet'
import { createProjectWithPayment, pushVersionWithPayment } from './x402'

interface TextUploadSession {
  type: 'text'
  projectName?: string
}

interface PendingRepoUpload {
  owner: string
  repo: string
  ref: string
  projectName: string
  filename: string
  filePath: string
  size: number
  price: PriceEstimate
}

interface RepoUploadSession {
  type: 'repo'
  projectName?: string
  pending?: PendingRepoUpload
}

export type UploadSession = TextUploadSession | RepoUploadSession

interface BotSession {
  wallet?: string
  encryptedKey?: string
  upload?: UploadSession
}

type MyContext = Context & SessionFlavor<BotSession>

export async function beginTextUpload(ctx: MyContext) {
  ctx.session.upload = { type: 'text' }
  await ctx.reply('Send me the project name for this upload:')
}

export async function beginRepoUpload(ctx: MyContext) {
  ctx.session.upload = { type: 'repo' }
  await ctx.reply('Send me the project name for this repo upload:')
}

export async function handleUploadMessage(ctx: MyContext) {
  const upload = ctx.session.upload
  if (!upload) return false

  if (!ctx.session.wallet || !ctx.session.encryptedKey) {
    await ctx.reply('You need a bot-managed wallet for uploads. Use /start → "🆕 New Wallet".')
    ctx.session.upload = undefined
    return true
  }

  if (!upload.projectName) {
    const text = ctx.message?.text?.trim()
    if (!text) {
      await ctx.reply('Please send a valid project name (text message).')
      return true
    }
    upload.projectName = text
    if (upload.type === 'repo') {
      await ctx.reply('Paste the GitHub repo URL or owner/repo (optionally @ref):')
    } else {
      await ctx.reply('Great. Now paste the content you want to store (text).')
    }
    return true
  }

  if (upload.type === 'text') {
    const content = ctx.message?.text
    if (!content) {
      await ctx.reply('Please send text content for the upload.')
      return true
    }
    
    const contentBytes = Buffer.from(content, 'utf8')
    const size = contentBytes.length
    
    try {
      // Get price estimate
      const price = await getUploadPriceEstimate(size)
      
      // Show confirmation
      const estimateLine = `Estimated cost: ${formatUsdc(price.total)} USDC (${price.totalUsd})`
      const summary = [
        `📝 Text Upload`,
        `Project: ${upload.projectName}`,
        `Size: ${formatBytes(size)}`,
        estimateLine,
        '',
        'This will:',
        '1. Upload content to Arweave',
        '2. Create project on Inkd Registry',
        '3. Deduct USDC from your wallet',
        '',
        'Continue?'
      ].join('\n')
      
      // For text uploads, we need a different confirmation flow
      // For now, just proceed (can add confirmation later)
      const statusMsg = await ctx.reply('⏳ Creating project on Inkd…')
      
      const wallet = getWalletFromEncrypted(ctx.session.encryptedKey)
      
      // Create project with x402 payment
      // Note: The API handles Arweave upload internally when given content
      const result = await createProjectWithPayment(wallet, {
        name: upload.projectName,
        description: `Text upload (${formatBytes(size)})`,
        license: 'MIT',
      })
      
      ctx.session.upload = undefined
      
      await ctx.api.editMessageText(
        ctx.chat!.id,
        statusMsg.message_id,
        `✅ Project created!\n\n` +
        `Project ID: #${result.projectId}\n` +
        `Owner: ${result.owner}\n` +
        `Tx: ${result.txHash}\n` +
        `Block: ${result.blockNumber}\n\n` +
        `Use /my_projects to view your projects.`
      )
    } catch (err) {
      await ctx.reply(`Upload failed: ${(err as Error).message}`)
      ctx.session.upload = undefined
    }
    return true
  }

  // Repo upload flow
  const link = ctx.message?.text?.trim()
  if (!link) {
    await ctx.reply('Please send the GitHub repo link or owner/repo.')
    return true
  }

  const projectName = upload.projectName

  try {
    if (upload.pending) {
      cleanupPending(upload.pending)
      upload.pending = undefined
    }

    const parsed = parseRepoInput(link)
    const ref = parsed.ref ?? (await fetchRepoDefaultBranch(parsed.owner, parsed.repo))

    await ctx.reply(`Downloading ${parsed.owner}/${parsed.repo}@${ref}…`)
    const { buffer, filename, size } = await downloadRepoZip({ owner: parsed.owner, repo: parsed.repo, ref })

    const price = await getUploadPriceEstimate(size)

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inkd-repo-'))
    const filePath = path.join(tempDir, filename)
    fs.writeFileSync(filePath, buffer)

    upload.pending = {
      owner: parsed.owner,
      repo: parsed.repo,
      ref,
      projectName,
      filename,
      filePath,
      size,
      price,
    }

    const estimateLine = `Estimated cost: ${formatUsdc(price.total)} USDC (${price.totalUsd})`
    const breakdownLine = `Includes ${formatUsdc(price.arweaveCost)} USDC storage + ${formatUsdc(price.markup)} USDC protocol fee.`
    const summary = [
      `📦 ${parsed.owner}/${parsed.repo}@${ref}`,
      `Project: ${projectName}`,
      `Size: ${formatBytes(size)}`,
      estimateLine,
      breakdownLine,
      '',
      'Upload with these details?'
    ].join('\n')

    const keyboard = new InlineKeyboard()
      .text('✅ Upload', 'repo_confirm')
      .text('✖️ Cancel', 'repo_cancel')

    await ctx.reply(summary, { reply_markup: keyboard })
  } catch (err) {
    upload.pending && cleanupPending(upload.pending)
    upload.pending = undefined
    await ctx.reply(`Repo preparation failed: ${(err as Error).message}`)
  }
  return true
}

export async function handleRepoConfirm(ctx: MyContext) {
  const upload = ctx.session.upload
  if (!upload || upload.type !== 'repo' || !upload.pending) {
    await ctx.answerCallbackQuery({ text: 'No pending repo upload.', show_alert: true })
    return
  }
  await ctx.answerCallbackQuery()

  const pending = upload.pending
  const wallet = ctx.session.wallet
  const encryptedKey = ctx.session.encryptedKey
  
  if (!wallet || !encryptedKey) {
    cleanupPending(pending)
    upload.pending = undefined
    await ctx.reply('You need a bot-managed wallet for uploads. Use /start → "🆕 New Wallet".')
    return
  }

  const statusMsg = await ctx.reply('⏳ Creating project on Inkd…')
  
  try {
    const walletInstance = getWalletFromEncrypted(encryptedKey)
    
    // Create project with x402 payment
    const result = await createProjectWithPayment(walletInstance, {
      name: pending.projectName,
      description: `GitHub: ${pending.owner}/${pending.repo}@${pending.ref}`,
      license: 'MIT',
    })
    
    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `✅ Project created!\n\n` +
      `Project ID: #${result.projectId}\n` +
      `Owner: ${result.owner}\n` +
      `Tx: ${result.txHash}\n` +
      `Block: ${result.blockNumber}\n\n` +
      `📦 Size: ${formatBytes(pending.size)}\n` +
      `Cost: ${formatUsdc(pending.price.total)} USDC\n\n` +
      `Use /my_projects to view your projects.`
    )
  } catch (err) {
    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `❌ Upload failed: ${(err as Error).message}`
    )
  } finally {
    cleanupPending(pending)
    upload.pending = undefined
    ctx.session.upload = undefined
  }
}

export async function handleRepoCancel(ctx: MyContext) {
  const upload = ctx.session.upload
  if (!upload || upload.type !== 'repo' || !upload.pending) {
    await ctx.answerCallbackQuery({ text: 'Nothing to cancel.', show_alert: true })
    return
  }
  await ctx.answerCallbackQuery()
  cleanupPending(upload.pending)
  upload.pending = undefined
  ctx.session.upload = undefined
  await ctx.reply('Upload cancelled.')
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(2)} MB`
}

function toNumber(value: number | string) {
  return typeof value === 'string' ? Number(value) : value
}

function formatUsdc(value: number | string) {
  const num = toNumber(value)
  return (num / 1_000_000).toFixed(4).replace(/0+$/, '').replace(/\.$/, '') || '0'
}

function cleanupPending(pending?: PendingRepoUpload) {
  if (!pending) return
  try {
    fs.rmSync(path.dirname(pending.filePath), { recursive: true, force: true })
  } catch {
    // ignore cleanup errors
  }
}
