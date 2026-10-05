/**
 * @file types.ts
 * @brief Dependencies and transport contracts shared by API handlers.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type {
	CommentRepository,
	LikeRepository,
	PostRepository,
	SessionRepository,
	TagRepository,
	UserRepository
} from '../db/repositories.js';
import type { PasswordResetDelivery } from '../auth/password-reset-delivery.js';
import type { StorageProvider } from '../media/storage.js';

export interface ApiDeps {
	users: UserRepository;
	sessions: SessionRepository;
	posts: PostRepository;
	tags: TagRepository;
	comments: CommentRepository;
	likes: LikeRepository;
	media: StorageProvider;
	passwordReset?: { delivery: PasswordResetDelivery; siteUrl: string };
	cookieSecure: boolean;
	allowedOrigins?: string[];
	clientAddress?: (req: IncomingMessage) => string;
	rateLimit?: { windowMs: number; requests: number; loginRequests: number; maxClients?: number };
}

export interface ErrorPayload {
	error: 'not_found' | 'method_not_allowed' | 'validation' | 'unauthorized' | 'forbidden'
		| 'conflict' | 'too_large' | 'rate_limited' | 'internal';
	message?: string;
	issues?: string[];
}

export type ApiHandler = (
	req: IncomingMessage, res: ServerResponse, deps: ApiDeps, url: URL, key: string
) => Promise<void>;
