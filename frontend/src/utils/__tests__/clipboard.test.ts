import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyToClipboard } from '../clipboard';

describe('clipboard util', () => {
    let originalClipboard: Clipboard;

    beforeEach(() => {
        originalClipboard = navigator.clipboard;
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockResolvedValue(undefined)
            }
        });
    });

    afterEach(() => {
        if (originalClipboard) {
            Object.assign(navigator, { clipboard: originalClipboard });
        }
        vi.restoreAllMocks();
    });

    it('uses navigator.clipboard API when available', async () => {
        const result = await copyToClipboard('test text');
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test text');
        expect(result).toBe(true);
    });

    it('returns false and logs error if clipboard API fails', async () => {
        (navigator.clipboard.writeText as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Not supported'));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await copyToClipboard('fallback text');

        expect(result).toBe(false);
        expect(consoleSpy).toHaveBeenCalled();
    });
});
