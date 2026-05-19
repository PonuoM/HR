/**
 * Tiny URL-template substitution used by external quick-link activities.
 *
 * Admin can store a URL like:
 *   https://asset.prima49.com/user_request.php?user_name={user_name}
 *
 * Frontend swaps each {token} with the (URI-encoded) value from the
 * current user before opening the link. Unknown tokens are left as-is
 * so a typo doesn't silently strip them.
 */

type UserVars = {
    id?: string;
    name?: string;
    nickname?: string | null;
    company_id?: number | string | null;
};

const TOKEN_RE = /\{(user_name|employee_id|nickname|company_id)\}/g;

export function substituteUrlVars(url: string | null | undefined, user?: UserVars | null): string {
    if (!url) return '';
    if (!user) return url;
    return url.replace(TOKEN_RE, (_match, key: string) => {
        switch (key) {
            case 'user_name':   return encodeURIComponent(user.name || '');
            case 'employee_id': return encodeURIComponent(user.id || '');
            case 'nickname':    return encodeURIComponent(user.nickname || '');
            case 'company_id':  return encodeURIComponent(String(user.company_id ?? ''));
            default:            return _match;
        }
    });
}
