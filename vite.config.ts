import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const site = (process.env.SITE_URL ?? loadEnv(mode, process.cwd(), 'SITE_URL').SITE_URL ?? '').trim()
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
          tags: siteUrl ? [
            { tag: 'link', attrs: { rel: 'canonical', href: siteUrl.href }, injectTo: 'head' },
            { tag: 'meta', attrs: { property: 'og:url', content: siteUrl.href }, injectTo: 'head' },
          ] : [],
        }
      },
    }],
  }
})
