import { defineEventHandler, readBody } from 'h3'
// import fetch from 'node-fetch'
import { useRuntimeConfig } from '#imports'

export default defineEventHandler(async (event) => {
  const { msg } = await readBody<{ msg: string }>(event)
  const { telegramBotToken: token, telegramChatIds } = useRuntimeConfig()

  // fire‐and‐forget to each chat
  for (const chatId of telegramChatIds as string[]) {
    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' })
    }).catch(() => {/* silent */})
  }

  return { ok: true }
})
