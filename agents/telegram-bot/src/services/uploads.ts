import type { Context, SessionFlavor } from 'grammy'
import { InlineKeyboard } from 'grammy'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseRepoInput, fetchRepoDefaultBranch, downloadRepoZip } from './github.js'
import { getUploadPriceEstimate, type PriceEstimate } from './api.js'
import { uploadToArweave, createProject, pushVersion } from './x402.js'

// ─── Session Types ────────────────────────────────────────────────────────────

interface PendingTextUpload {
  content: string
  size: number
  price: PriceEstimate
}

interface TextUploadSession {
  type: 'text'
  projectName?: string
  pending?: PendingTextUpload
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

// ─── Begin Upload Flows ───────────────────────────────────────────────────────

export async function beginTextUpload(ctx: MyContext) {
  ctx.session.upload = { type: 'text' }
  await ctx.reply('Send me the project name for this upload:')
}

export async function beginRepoUpload(ctx: MyContext) {
  ctx.session.upload = { type: 'repo' }
  await ctx.reply('Send me the project name for this repo upload:')
}

// ─── Handle Upload Messages ───────────────────────────────────────────────────

export async function handleUploadMessage(ctx: MyContext) {
  const upload = ctx.session.upload
  if (!upload) return false

  if (!ctx.session.wallet || !ctx.session.encryptedKey) {
    await ctx.reply('You need a bot-managed wallet for uploads. Use /start → "🆕 New Wallet".')
    ctx.session.upload = undefined
    return true
  }

  // Step 1: Get project name
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

  // Text upload flow: collect content and show confirmation
  if (upload.type === 'text') {
    const content = ctx.message?.text
    if (!content) {
      await ctx.reply('Please send text content for the upload.')
      return true
    }

    const contentBytes = Buffer.from(content, 'utf8')
    const size = contentBytes.length

    try {
      const price = await getUploadPriceEstimate(size)

      // Store pending upload
      upload.pending = {
        content,
        size,
        price,
      }

      const estimateLine = `Estimated cost: ${formatUsdc(price.total)} USDC (${price.totalUsd})`
      const breakdownLine = `Includes ${formatUsdc(price.arweaveCost)} USDC storage + ${formatUsdc(price.markup)} USDC protocol fee.`
      const summary = [
        `📝 Text Upload`,
        `Project: ${upload.projectName}`,
        `Size: ${formatBytes(size)}`,
        estimateLine,
        breakdownLine,
        '',
        'This will:',
        '1. Upload content to Arweave',
        '2. Create project on Inkd Registry',
        '3. Push version with content',
        '',
        'Continue?',
      ].join('\n')

      const keyboard = new InlineKeyboard()
        .text('✅ Upload', 'text_confirm')
        .text('✖️ Cancel', 'text_cancel')

      await ctx.reply(summary, { reply_markup: keyboard })
    } catch (err) {
      await ctx.reply(`Failed to get price estimate: ${(err as Error).message}`)
      ctx.session.upload = undefined
    }
    return true
  }

  // Repo upload flow: collect GitHub link
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
      'Upload with these details?',
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

// ─── Text Upload Handlers ─────────────────────────────────────────────────────

export async function handleTextConfirm(ctx: MyContext) {
  const upload = ctx.session.upload
  if (!upload || upload.type !== 'text' || !upload.pending) {
    await ctx.answerCallbackQuery({ text: 'No pending text upload.', show_alert: true })
    return
  }
  await ctx.answerCallbackQuery()

  const pending = upload.pending
  const projectName = upload.projectName!
  const encryptedKey = ctx.session.encryptedKey

  if (!encryptedKey) {
    upload.pending = undefined
    ctx.session.upload = undefined
    await ctx.reply('You need a bot-managed wallet for uploads. Use /start → "🆕 New Wallet".')
    return
  }

  const statusMsg = await ctx.reply('⏳ Step 1/3: Uploading to Arweave…')

  try {
    // Step 1: Upload content to Arweave
    const contentBuffer = Buffer.from(pending.content, 'utf8')
    const arweaveResult = await uploadToArweave(contentBuffer, 'text/plain', `${projectName}.txt`)

    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `✅ Step 1/3: Uploaded to Arweave\n` +
        `   Hash: ${arweaveResult.hash}\n\n` +
        `⏳ Step 2/3: Creating project…`
    )

    // Step 2: Create project with x402 payment
    const projectResult = await createProject(encryptedKey, {
      name: projectName,
      description: `Text upload (${formatBytes(pending.size)})`,
      license: 'MIT',
    })

    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `✅ Step 1/3: Uploaded to Arweave\n` +
        `   Hash: ${arweaveResult.hash}\n\n` +
        `✅ Step 2/3: Project created\n` +
        `   ID: #${projectResult.projectId}\n\n` +
        `⏳ Step 3/3: Pushing version…`
    )

    // Step 3: Push version with x402 payment
    const versionResult = await pushVersion(encryptedKey, projectResult.projectId, {
      arweaveHash: arweaveResult.hash,
      versionTag: 'v1.0.0',
      changelog: 'Initial upload',
      contentSize: pending.size,
    })

    // Success
    ctx.session.upload = undefined

    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `✅ Upload Complete!\n\n` +
        `📂 Project: ${projectName} (#${projectResult.projectId})\n` +
        `📦 Version: ${versionResult.versionTag}\n\n` +
        `🔗 Arweave: https://arweave.net/${arweaveResult.txId}\n` +
        `🔗 Project Tx: ${projectResult.txHash}\n` +
        `🔗 Version Tx: ${versionResult.txHash}\n\n` +
        `Use /my_projects to view your projects.`
    )
  } catch (err) {
    ctx.session.upload = undefined
    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `❌ Upload failed: ${(err as Error).message}`
    )
  }
}

export async function handleTextCancel(ctx: MyContext) {
  const upload = ctx.session.upload
  if (!upload || upload.type !== 'text') {
    await ctx.answerCallbackQuery({ text: 'Nothing to cancel.', show_alert: true })
    return
  }
  await ctx.answerCallbackQuery()
  upload.pending = undefined
  ctx.session.upload = undefined
  await ctx.reply('Upload cancelled.')
}

// ─── Repo Upload Handlers ─────────────────────────────────────────────────────

export async function handleRepoConfirm(ctx: MyContext) {
  const upload = ctx.session.upload
  if (!upload || upload.type !== 'repo' || !upload.pending) {
    await ctx.answerCallbackQuery({ text: 'No pending repo upload.', show_alert: true })
    return
  }
  await ctx.answerCallbackQuery()

  const pending = upload.pending
  const encryptedKey = ctx.session.encryptedKey

  if (!encryptedKey) {
    cleanupPending(pending)
    upload.pending = undefined
    ctx.session.upload = undefined
    await ctx.reply('You need a bot-managed wallet for uploads. Use /start → "🆕 New Wallet".')
    return
  }

  const statusMsg = await ctx.reply('⏳ Step 1/3: Uploading to Arweave…')

  try {
    // Step 1: Upload ZIP to Arweave
    const zipBuffer = fs.readFileSync(pending.filePath)
    const arweaveResult = await uploadToArweave(zipBuffer, 'application/zip', pending.filename)

    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `✅ Step 1/3: Uploaded to Arweave\n` +
        `   Hash: ${arweaveResult.hash}\n\n` +
        `⏳ Step 2/3: Creating project…`
    )

    // Step 2: Create project with x402 payment
    const projectResult = await createProject(encryptedKey, {
      name: pending.projectName,
      description: `GitHub: ${pending.owner}/${pending.repo}@${pending.ref}`,
      license: 'MIT',
    })

    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `✅ Step 1/3: Uploaded to Arweave\n` +
        `   Hash: ${arweaveResult.hash}\n\n` +
        `✅ Step 2/3: Project created\n` +
        `   ID: #${projectResult.projectId}\n\n` +
        `⏳ Step 3/3: Pushing version…`
    )

    // Step 3: Push version with x402 payment
    const versionResult = await pushVersion(encryptedKey, projectResult.projectId, {
      arweaveHash: arweaveResult.hash,
      versionTag: 'v1.0.0',
      changelog: `Source: ${pending.owner}/${pending.repo}@${pending.ref}`,
      contentSize: pending.size,
    })

    // Success
    ctx.session.upload = undefined

    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `✅ Upload Complete!\n\n` +
        `📂 Project: ${pending.projectName} (#${projectResult.projectId})\n` +
        `📦 Version: ${versionResult.versionTag}\n` +
        `📁 Source: ${pending.owner}/${pending.repo}@${pending.ref}\n\n` +
        `🔗 Arweave: https://arweave.net/${arweaveResult.txId}\n` +
        `🔗 Project Tx: ${projectResult.txHash}\n` +
        `🔗 Version Tx: ${versionResult.txHash}\n\n` +
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
