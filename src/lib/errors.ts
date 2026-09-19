/**
 * 業務上のエラー（そのままユーザーへ表示してよいもの）。
 *
 * `server-only` を含まない独立モジュールに置くことで、
 * service 層とテストの双方から安全に import できる。
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
