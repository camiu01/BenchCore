/**
 * @file security-repository.ts
 * @brief Atomic second-factor persistence, bounded security history and audited post deletion.
 */
export type SecurityAction = 'user.created' | 'user.changed' | 'password.changed' | 'password.reset'
	| 'sessions.revoked' | 'totp.enabled' | 'totp.disabled' | 'posts.deleted' | 'comment.moderated' | 'comment.deleted';

export interface SecurityEventInput {
	action: SecurityAction;
	actorId: string | null;
	targetId: string | null;
	count?: number;
}

export interface SecurityEvent extends SecurityEventInput {
	id: string;
	count: number;
	createdAt: Date;
}

export interface TotpCredential {
	userId: string;
	sealedSecret: string;
	lastStep: number;
}

export interface SecurityRepository {
	/** @brief Appends a credential-free event. @param event Allowlisted fields. @return Completion. */
	record(event: SecurityEventInput): Promise<void>;
	/** @brief Lists newest events with bounded pagination. @param offset Validated offset. @return At most 51 events. */
	listEvents(offset: number): Promise<SecurityEvent[]>;
	/** @brief Loads an encrypted factor. @param userId Owner. @return Factor or null. */
	findTotp(userId: string): Promise<TotpCredential | null>;
	/** @brief Consumes a code once against current credentials. @param userId Owner. @param version Session epoch. @param step Time step. @return Whether consumed. */
	consumeTotp(userId: string, version: number, step: number): Promise<boolean>;
	/** @brief Enables a factor and revokes sessions atomically. @param userId Owner. @param version Epoch. @param passwordHash Expected password. @param secret Ciphertext. @param step Verified step. @return Whether enabled. */
	enableTotp(userId: string, version: number, passwordHash: string, secret: string, step: number): Promise<boolean>;
	/** @brief Removes a verified factor and revokes sessions atomically. @param userId Owner. @param version Epoch. @param passwordHash Expected password. @param step Verified step. @return Whether disabled. */
	disableTotp(userId: string, version: number, passwordHash: string, step: number): Promise<boolean>;
	/** @brief Deletes a bounded selected set and records it atomically. @param actorId Administrator. @param ids Selected ids. @return Deleted count. */
	deletePosts(actorId: string, ids: string[]): Promise<number>;
}
