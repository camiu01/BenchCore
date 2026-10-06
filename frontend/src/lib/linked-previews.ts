/**
 * @file linked-previews.ts
 * @brief Delayed hover/focus previews for safe wikilinks and graph nodes.
 */
export interface PreviewTarget {
	slug: string;
	x: number;
	y: number;
}
export interface PreviewController {
	open(slug: string, anchor: Element): void;
	close(): void;
	hold(): void;
	dismiss(): void;
	destroy(): void;
}

/** @brief Coordinates delayed opening, pointer transfer and immediate Escape dismissal. @param change Presentation callback. @return Lifecycle-safe controller. */
export function createPreviewController(
	change: (target: PreviewTarget | null) => void
): PreviewController {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let anchor: Element | null = null;
	/** @brief Clears a pending timer. @return Nothing. */
	function clear(): void {
		clearTimeout(timer);
		timer = undefined;
	}
	return {
		open: (slug, element) => {
			clear();
			if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return;
			anchor = element;
			timer = setTimeout(() => {
				const rect = element.getBoundingClientRect();
				change({
					slug,
					x: Math.max(8, Math.min(rect.left, window.innerWidth - 328)),
					y: Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 320))
				});
			}, 180);
		},
		close: () => {
			clear();
			timer = setTimeout(() => change(null), 180);
		},
		hold: clear,
		dismiss: () => {
			clear();
			change(null);
			if (anchor && 'focus' in anchor && typeof anchor.focus === 'function') anchor.focus();
			clear();
		},
		destroy: () => {
			clear();
			change(null);
		}
	};
}

/** @brief Attaches delegated events to sanitized wikilinks only; ordinary links stay untouched. @param node Reader body. @param controller Preview coordinator. @return Event cleanup. */
export function linkedPostPreviews(node: HTMLElement, controller: PreviewController) {
	/** @brief Finds only safe rendered wikilinks. @param target Event target. @return Link and target slug. */
	function link(target: EventTarget | null) {
		if (!(target instanceof Element)) return null;
		const anchor = target.closest('a.wikilink');
		if (!anchor || !node.contains(anchor)) return null;
		const match = /^\/posts\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(anchor.getAttribute('href') ?? '');
		return match ? { anchor, slug: match[1]! } : null;
	}
	/** @brief Opens a pointer or keyboard target without intercepting navigation. @param event Event. @return Nothing. */
	function enter(event: Event) {
		const target = link(event.target);
		if (target) controller.open(target.slug, target.anchor);
	}
	/** @brief Defers dismissal to allow entering the card. @param event Event. @return Nothing. */
	function leave(event: Event) {
		if (link(event.target)) controller.close();
	}
	/** @brief Dismisses keyboard previews without consuming unrelated keys. @param event Event. @return Nothing. */
	function key(event: KeyboardEvent) {
		if (event.key === 'Escape') controller.dismiss();
	}
	node.addEventListener('pointerover', enter);
	node.addEventListener('focusin', enter);
	node.addEventListener('pointerout', leave);
	node.addEventListener('focusout', leave);
	node.addEventListener('keydown', key);
	return {
		destroy: () => {
			node.removeEventListener('pointerover', enter);
			node.removeEventListener('focusin', enter);
			node.removeEventListener('pointerout', leave);
			node.removeEventListener('focusout', leave);
			node.removeEventListener('keydown', key);
			controller.destroy();
		}
	};
}
