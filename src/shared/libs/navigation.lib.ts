export function findActiveItem<T extends { href: string }>(
  items: T[],
  pathname: string,
): T | undefined {
  return items
    .filter(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
}
