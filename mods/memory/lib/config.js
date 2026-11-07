/** 插件配置（全部有默认值；挂载时通过 cordis.patch.yml 的 config 或宿主 profile 覆盖）。 */
export const DEFAULT_CONFIG = {
    daily_time: '04:00:00',
    scan_sessions: 12,
    shard_threshold: 80,
    enable_shard: true,
};
/**
 * 归一每日整理时间，**输出恒为 `HH:mm:ss`**。
 *
 * dsh ≥0.2.0-rc.2 的 schedule `daily.time` 只接受 `HH:mm:ss[.SSS]`（秒必填），
 * 传 `HH:mm` 会被 `invalid_rule` 拒绝——这里统一补秒，输入兼容 `H:MM` / `HH:MM` / `HH:MM:SS`。
 */
export function normalizeDailyTime(value) {
    const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec((value ?? '').trim());
    if (match === null)
        return DEFAULT_CONFIG.daily_time;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = match[3] === undefined ? 0 : Number(match[3]);
    if (!Number.isInteger(hours) || hours < 0 || hours > 23)
        return DEFAULT_CONFIG.daily_time;
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59)
        return DEFAULT_CONFIG.daily_time;
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 59)
        return DEFAULT_CONFIG.daily_time;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
export function normalizeTimeZone(value) {
    const trimmed = value?.trim();
    if (trimmed)
        return trimmed;
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    }
    catch {
        return 'UTC';
    }
}
