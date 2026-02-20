import { Context, Schema, h, Binary, Session } from 'koishi'

export const name = 'github-og'

export const inject = ['http']

export const usage = `
## 响应的消息格式
* koishijs/koishi
* https://github.com/koishijs/koishi
`

export interface Config {
  notFoundAction: 'default_image' | 'custom_tip' | 'no_response'
  notFoundTip?: string
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    notFoundAction: Schema.union([
      Schema.const('default_image').description('返回默认图片'),
      Schema.const('custom_tip').description('返回自定义提示'),
      Schema.const('no_response').description('不作响应')
    ]).description('仓库不存在时的行为').default('default_image')
  }),
  Schema.union([
    Schema.object({
      notFoundAction: Schema.const('default_image')
    }),
    Schema.object({
      notFoundAction: Schema.const('custom_tip'),
      notFoundTip: Schema.string().role('textarea').description('自定义提示').required()
    }),
    Schema.object({
      notFoundAction: Schema.const('no_response')
    })
  ])
])

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

export function apply(ctx: Context, cfg: Config) {
  async function sendContent(session: Session, url: string) {
    const resp = await ctx.http(url, { responseType: 'arraybuffer' })
    if (resp.headers.get('cache-control').includes('max-age=0')) {
      if (cfg.notFoundAction === 'custom_tip') {
        return await session.send(cfg.notFoundTip)
      } else if (cfg.notFoundAction === 'no_response') {
        return
      }
    }
    await session.send(h.img(resp.data, resp.headers.get('content-type')))
  }

  ctx.on('message-created', async (session) => {
    const input = h.select(session.elements, 'text').join('').trim()
    if (input.startsWith(`https://github.com/`) && isValidHttpUrl(input)) {
      const parts = input.split('/')
      const owner = parts[3]
      const repository = parts[4]
      if (owner && repository) {
        const originalUrl = `https://github.com/${owner}/${repository}`
        const hashHex = await digest(originalUrl)
        await sendContent(session, `https://opengraph.githubassets.com/${hashHex}/${owner}/${repository}`)
      }
    } else if (/^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(input)) {
      const parts = input.split('/')
      if (Number.isInteger(+parts[0])) return
      const originalUrl = `https://github.com/${input}`
      const hashHex = await digest(originalUrl)
      await sendContent(session, `https://opengraph.githubassets.com/${hashHex}/${input}`)
    }
  })
}
