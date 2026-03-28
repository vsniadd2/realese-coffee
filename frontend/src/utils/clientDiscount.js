/** Скидки клиента: персональная % и GOLD 10% суммируются, итог не больше 100%. */

export function clampDiscountPercent(v) {
  const n = Number.parseFloat(v)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(100, Math.max(0, n))
}

export function personalDiscountPercent(client) {
  return clampDiscountPercent(client?.personal_discount_percent)
}

/** GOLD 10% на эту покупку (как на бэкенде для существующего клиента). */
export function goldDiscountPercentForPurchase(client, orderAmount) {
  if (!client) return 0
  const total = Number.parseFloat(client.total_spent) || 0
  const price = Number.parseFloat(orderAmount) || 0
  const newTotal = total + price
  const alreadyGold = (client.status || 'standart') === 'gold'
  if (newTotal >= 500 || alreadyGold) return 10
  return 0
}

export function effectiveDiscountPercentForPurchase(client, orderAmount) {
  const sum =
    personalDiscountPercent(client) + goldDiscountPercentForPurchase(client, orderAmount)
  return Math.min(100, sum)
}

export function priceAfterPercentDiscount(price, discountPercent) {
  const p = Number.parseFloat(price) || 0
  const d = clampDiscountPercent(discountPercent)
  return p * (1 - d / 100)
}

/** Для превью в модалке заказа / новый заказ */
export function buildPurchaseDiscountInfo(client, orderAmount) {
  const p = Number.parseFloat(orderAmount) || 0
  if (!client || p <= 0) return null
  const d = effectiveDiscountPercentForPurchase(client, p)
  if (d <= 0) return null
  const finalPrice = priceAfterPercentDiscount(p, d)
  return {
    hasDiscount: true,
    originalPrice: p,
    finalPrice,
    discount: d,
    savedAmount: p - finalPrice
  }
}

/** Замена заказа: только текущий статус и персональная (без пересчёта порога 500). */
export function replacementEffectiveDiscountPercent(order) {
  if (!order || order.client_id == null) return 0
  const personal = clampDiscountPercent(order.client_personal_discount)
  const gold = (order.client_status || 'standart') === 'gold' ? 10 : 0
  return Math.min(100, personal + gold)
}

export function buildReplacementDiscountInfo(order, orderAmount) {
  const p = Number.parseFloat(orderAmount) || 0
  if (!order || p <= 0 || order.client_id == null) return null
  const d = replacementEffectiveDiscountPercent(order)
  if (d <= 0) return null
  const finalPrice = priceAfterPercentDiscount(p, d)
  return {
    hasDiscount: true,
    originalPrice: p,
    finalPrice,
    discount: d,
    savedAmount: p - finalPrice
  }
}
