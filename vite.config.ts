import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), ['SITE_URL', 'GOATCOUNTER_URL'])
  const site = (process.env.SITE_URL ?? env.SITE_URL ?? '').trim()
  const goatcounter = (process.env.GOATCOUNTER_URL ?? env.GOATCOUNTER_URL ?? '').trim()
  const goatcounterUrl = goatcounter ? new URL(goatcounter) : null
  if (goatcounterUrl && (
    goatcounterUrl.protocol !== 'https:' ||
    !/^[a-z0-9-]+\.goatcounter\.com$/.test(goatcounterUrl.hostname) ||
    goatcounterUrl.username || goatcounterUrl.password || goatcounterUrl.port ||
    goatcounterUrl.search || goatcounterUrl.hash ||
    !['/', '/count'].includes(goatcounterUrl.pathname)
  )) throw new Error('GOATCOUNTER_URL must be https://YOURCODE.goatcounter.com or its /count endpoint.')
  const analyticsEnabled = command === 'build' && mode === 'production' && Boolean(goatcounterUrl)
  const siteUrl = site ? new URL(site) : null
  if (siteUrl && !['http:', 'https:'].includes(siteUrl.protocol)) throw new Error('SITE_URL must be an HTTP or HTTPS URL.')
  return {
    plugins: [react(), {
      name: 'share-metadata',
      transformIndexHtml(html) {
        const image = siteUrl ? new URL('/share-card.png', siteUrl).href : '/share-card.png'
        const result = html.replaceAll('__SHARE_IMAGE_URL__', image.replaceAll('&', '&amp;').replaceAll('"', '&quot;'))
        return {
          html: result,
          tags: [...(siteUrl ? [
            { tag: 'link', attrs: { rel: 'canonical', href: siteUrl.href }, injectTo: 'head' },
            { tag: 'meta', attrs: { property: 'og:url', content: siteUrl.href }, injectTo: 'head' },
          ] : []), ...(analyticsEnabled ? [
            { tag: 'script', attrs: { async: true, src: 'https://gc.zgo.at/count.js', 'data-goatcounter': new URL('/count', goatcounterUrl!).href }, injectTo: 'head' as const },
          ] : [])],
        }
      },
    }],
  }
})
