import { formatDistanceToNow } from 'date-fns';
import { enUS } from 'date-fns/locale';

// English-only build: the language argument is accepted for API compatibility but ignored.
export function formatRelativeTime(timestamp: number, _language: string = 'en'): string {
    return formatDistanceToNow(new Date(timestamp * 1000), {
        addSuffix: true,
        locale: enUS,
    });
}

export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export function getQuotaColor(percentage: number): string {
    if (percentage >= 50) return 'success';
    if (percentage >= 20) return 'warning';
    return 'error';
}

export function parseFlexibleDate(dateStr: string | undefined | null): Date | null {
    if (!dateStr || dateStr.trim() === '') return null;
    const trimmed = dateStr.trim();
    // 兼容纯数字 Unix 时间戳（秒或毫秒）
    if (/^\d+$/.test(trimmed)) {
        const num = parseInt(trimmed, 10);
        return new Date(trimmed.length <= 10 ? num * 1000 : num);
    }
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : parsed;
}

export function formatTimeRemaining(dateStr: string): string {
    const targetDate = parseFlexibleDate(dateStr);
    if (!targetDate) return '0h 0m';

    const now = new Date();
    const diffMs = targetDate.getTime() - now.getTime();

    if (diffMs <= 0) return '0h 0m';

    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHrs >= 24) {
        const diffDays = Math.floor(diffHrs / 24);
        const remainingHrs = diffHrs % 24;
        return `${diffDays}d ${remainingHrs}h`;
    }

    return `${diffHrs}h ${diffMins}m`;
}

export function getTimeRemainingColor(dateStr: string | undefined): string {
    if (!dateStr) return 'gray';
    const targetDate = parseFlexibleDate(dateStr);
    if (!targetDate) return 'gray';

    const now = new Date();
    const diffMs = targetDate.getTime() - now.getTime();

    if (diffMs <= 0) return 'success'; // 已经过期的也算成功（即将重置或已重置）

    const diffHrs = diffMs / (1000 * 60 * 60);

    if (diffHrs < 1) return 'success';   // < 1h: 绿色 (快重置了)
    if (diffHrs < 6) return 'warning';   // 1-6h: 琥珀色 (等待中)
    return 'neutral';                   // > 6h: 灰色 (长等待)
}

export function formatDate(timestamp: string | number | undefined | null): string | null {
    if (!timestamp) return null;
    const date = typeof timestamp === 'number'
        ? new Date(timestamp * 1000)
        : new Date(timestamp);

    if (isNaN(date.getTime())) return null;

    return date.toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

export function formatCompactNumber(num: number): string {
    if (num === 0) return '0';
    if (num < 1000 && num > -1000) return num.toString();

    const units = ['', 'k', 'M', 'G', 'T', 'P'];
    const absNum = Math.abs(num);
    const i = Math.floor(Math.log10(absNum) / 3);
    const value = num / Math.pow(1000, i);

    // Round to 1 decimal place if needed
    const formatted = value.toFixed(Math.abs(value) < 10 && i > 0 ? 1 : 0);
    return `${formatted.replace(/\.0$/, '')}${units[i]}`;
}

/**
 * Masks an email to show the first 3 characters and the tail characters before '@' with *** in between.
 * Example: "user12345@gmail.com" -> "use***45"
 * Example: "kdmhg4@gmail.com" -> "kdm***g4"
 */
export function maskEmail(email: string | undefined | null): string {
    if (!email) return '';
    const trimmed = email.trim();
    const atIndex = trimmed.indexOf('@');

    if (atIndex > 0) {
        const localPart = trimmed.slice(0, atIndex);
        if (localPart.length <= 2) {
            return '***';
        }
        if (localPart.length === 3) {
            return `${localPart[0]}***${localPart[2]}`;
        }
        if (localPart.length === 4) {
            return `${localPart.slice(0, 2)}***${localPart.slice(-2)}`;
        }
        const first = localPart.slice(0, 3);
        const tail = localPart.slice(-2);
        return `${first}***${tail}`;
    }

    if (trimmed.length <= 5) {
        return '***';
    }
    const first = trimmed.slice(0, 3);
    const last = trimmed.slice(-2);
    return `${first}***${last}`;
}

/**
 * Returns the display name for an account.
 * If an explicit text (custom_label) is provided, it replaces the email.
 * Otherwise, the email is displayed masked by default.
 */
export function getAccountDisplayName(
    account: { email: string; custom_label?: string | null } | undefined | null,
    mask: boolean = true
): string {
    if (!account) return '';
    if (account.custom_label && account.custom_label.trim().length > 0) {
        return account.custom_label.trim();
    }
    return mask ? maskEmail(account.email) : (account.email || '');
}
