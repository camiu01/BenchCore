/**
 * @file navigation.ts
 * @brief Public navigation labels for signed-in administrators and other visitors.
 */

/**
 * @brief Chooses Login, Account or Admin to match the current session.
 * @param role Current session role or null.
 * @param index Navigation position.
 * @return Navigation href and numbered label.
 */
export function authenticationLink(role: string | null, index: string) {
	if (role === 'admin') return { href: '/admin', label: `[${index}] admin` };
	if (role === 'reader') return { href: '/account', label: `[${index}] account` };
	return { href: '/login', label: `[${index}] login` };
}
