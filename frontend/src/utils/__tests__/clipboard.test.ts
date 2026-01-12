import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyToClipboard } from '../clipboard';

describe('clipboard util', () => {
    let originalClipboard: Clipboard;

    beforeEach(() => {
        originalClipboard = navigator.clipboard;
        // Mock clipboard API
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockResolvedValue(undefined)
            }
        });

        // Mock deprecated execCommand for fallback test
        document.execCommand = vi.fn().mockReturnValue(true);
    });

    afterEach(() => {
        // Restore
        if (originalClipboard) {
            Object.assign(navigator, { clipboard: originalClipboard });
        } else {
            // If it was undefined, delete it (careful in jsdom)
            // simplified: just keep mock, tests are isolated
        }
        vi.restoreAllMocks();
    });

    it('uses navigator.clipboard API when available', async () => {
        const result = await copyToClipboard('test text');
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test text');
        expect(result).toBe(true);
    });

    it('falls back to execCommand if clipboard API fails', async () => {
        // Force failure
        (navigator.clipboard.writeText as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Not supported'));

        const result = await copyToClipboard('fallback text');

        expect(document.execCommand).toHaveBeenCalledWith('copy');
        expect(result).toBe(true);
    });
});
