import type { Context, SessionFlavor } from 'grammy'
import { uploadText, uploadBinary } from './arweave'
import { createProject } from './registry'
import { parseRepoInput, fetchRepoDefaultBranch, downloadRepoZip } from './github'

interface TextUploadSession {
  type: 'text'
  projectName?: string
}

interface RepoUploadSession {
  type: 'repo'
  projectName?: string
}

export type UploadSession = TextUploadSession | RepoUploadSession

interface BotSession {
  wallet?: string
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

  if (!ctx.session.wallet) {
    await ctx.reply('Connect your wallet first with /start.')
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
    try {
      const wallet = ctx.session.wallet!
      const receipt = await uploadText(content, {
        'Project-Name': upload.projectName,
        'Wallet': wallet,
      })
      const tx = await createProject(wallet, upload.projectName, receipt.hash)
      ctx.session.upload = undefined
      await ctx.reply(
        `Stored ${content.length} characters on Arweave:\n${receipt.hash}\n${receipt.url}\nTx: ${receipt.txId}\n\nOn-chain: ${tx.transactionHash}`
      )
    } catch (err) {
      await ctx.reply(`Upload failed: ${(err as Error).message}`)
    }
    return true
  }

  // repo flow: upload.type === 'repo', projectName is set, next message is the GitHub link
  const link = ctx.message?.text?.trim()
  if (!link) {
    await ctx.reply('Please send the GitHub repo link or owner/repo.')
    return true
  }

  const wallet = ctx.session.wallet!
  const projectName = upload.projectName

  try {
    const parsed = parseRepoInput(link)
    const ref = parsed.ref ?? (await fetchRepoDefaultBranch(parsed.owner, parsed.repo))

    await ctx.reply(`Downloading ${parsed.owner}/${parsed.repo}@${ref}…`)
    const { buffer, filename, size } = await downloadRepoZip({ owner: parsed.owner, repo: parsed.repo, ref })

    await ctx.reply(`Uploading ${(size / 1024).toFixed(1)} KB to Arweave…`)
    const receipt = await uploadBinary(buffer, { contentType: 'application/zip', filename, tags: {
      'Project-Name': projectName,
      'Wallet': wallet,
      'Repo': `${parsed.owner}/${parsed.repo}`,
      'Ref': ref,
    }})
    const tx = await createProject(wallet, projectName, receipt.hash)
    ctx.session.upload = undefined
    await ctx.reply(
      `Stored ${(size / 1024).toFixed(1)} KB (${filename}) on Arweave:\n${receipt.hash}\n${receipt.url}\nTx: ${receipt.txId}\n\nOn-chain: ${tx.transactionHash}`
    )
  } catch (err) {
    ctx.session.upload = undefined
    await ctx.reply(`Repo upload failed: ${(err as Error).message}`)
  }
  return true
}
