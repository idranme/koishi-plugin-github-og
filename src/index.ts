import { Context, Schema, h } from 'koishi'

export const name = 'github-og'

export const usage = `
## 响应的消息格式
* koishijs/koishi
* https://github.com/koishijs/koishi
`

export interface Config { }

export const Config: Schema<Config> = Schema.object({})

async function digest(message: string) {
  const msgUint8 = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return hashHex
}

function isValidHttpUrl(str:string) {
  const pattern = new RegExp(
    '^(https?:\\/\\/)?' + // protocol
      '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
      '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
      '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
      '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
      '(\\#[-a-z\\d_]*)?$', // fragment locator
    'i'
  )
  return pattern.test(str)
}

export function apply(ctx: Context) {
  ctx.on('message-created', async (session) => {
    const input = session.content.trim()
    if (input.startsWith(`https://github.com/`) && isValidHttpUrl(input)) {
      const parts = input.split('/')
      const owner = parts[3]
      const repository = parts[4]
      if (owner && repository) {
        const originalUrl = `https://github.com/${owner}/${repository}`
        const hashHex = await digest(originalUrl)
        await session.send(h.image(`https://opengraph.githubassets.com/${hashHex}/${owner}/${repository}`))
      }
      return
    }
    if (/^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(input)) {
      const originalUrl = `https://github.com/${input}`
      const hashHex = await digest(originalUrl)
      return await session.send(h.image(`https://opengraph.githubassets.com/${hashHex}/${input}`))
    }
  })
}
