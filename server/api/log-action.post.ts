// server/api/log-action.post.ts
import { defineEventHandler, readBody } from 'h3'
// import fetch from 'node-fetch'
import { useRuntimeConfig } from '#imports'

export default defineEventHandler(async (event) => {
  const { msg } = await readBody<{ msg: string }>(event)
  const { telegramBotToken: token, telegramChatId: chatId } = useRuntimeConfig()


  const res = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: msg,
        parse_mode: 'HTML'
      })
    }
  )

  if (!res.ok) {
    console.error('Telegram log failed:', await res.text())
  }

  return { ok: true }
})
