import { useRuntimeConfig } from '#imports'
import fetch from 'node-fetch'

export async function notifyTelegram(message: string) {
  const config = useRuntimeConfig()
  const token = config.telegramBotToken
  const chatId = config.telegramChatId

  const url = `https://api.telegram.org/bot${token}/sendMessage`
  const body = {
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML'
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Telegram error:', err)
  }
}
