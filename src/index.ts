import { Context, Schema, h, Binary } from 'koishi'

export const name = 'github-og'

export const usage = `
## 响应的消息格式
* koishijs/koishi
* https://github.com/koishijs/koishi
`

export interface Config { }

export const Config: Schema<Config> = Schema.object({})

async function digest(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  return Binary.toHex(hashBuffer)
}

function isValidHttpUrl(str: string): boolean {
  // forked from https://gist.github.com/dperini/729294
  const pattern = new RegExp(
    "^" +
    // protocol identifier (optional)
    // short syntax // still required
    "(?:(?:(?:https?):)?\\/\\/)" +
    "(?:" +
    // host & domain names, may end with dot
    // can be replaced by a shortest alternative
    // (?![-_])(?:[-\\w\\u00a1-\\uffff]{0,63}[^-_]\\.)+
    "(?:" +
    "(?:" +
    "[a-z0-9\\u00a1-\\uffff]" +
    "[a-z0-9\\u00a1-\\uffff_-]{0,62}" +
    ")?" +
    "[a-z0-9\\u00a1-\\uffff]\\." +
    ")+" +
    // TLD identifier name, may end with dot
    "(?:[a-z\\u00a1-\\uffff]{2,}\\.?)" +
    ")" +
    // resource path (optional)
    "(?:[/?#]\\S*)?" +
    "$", "i"
  )
  return pattern.test(str)
}

export function apply(ctx: Context) {
  ctx.on('message-created', async (session) => {
    const input = h.select(session.elements, 'text').join('').trim()
    if (input.startsWith(`https://github.com/`) && isValidHttpUrl(input)) {
      const parts = input.split('/')
      const owner = parts[3]
      const repository = parts[4]
      if (owner && repository) {
        const originalUrl = `https://github.com/${owner}/${repository}`
        const hashHex = await digest(originalUrl)
        await session.send(h.img(`https://opengraph.githubassets.com/${hashHex}/${owner}/${repository}`))
      }
      return
    }
    if (/^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(input)) {
      const parts = input.split('/')
      if (Number.isInteger(+parts[0])) return
      const originalUrl = `https://github.com/${input}`
      const hashHex = await digest(originalUrl)
      return await session.send(h.img(`https://opengraph.githubassets.com/${hashHex}/${input}`))
    }
  })
}
