import { describe, it, expect, vi } from 'vitest';
import { pushBackHandler, handleBack, getBackHandlerCount } from './backHandler';

describe('backHandler', () => {
    it('pushes, executes in LIFO order, and unregisters properly', () => {
        const order = [];
        const unregister1 = pushBackHandler(() => { order.push(1); return true; });
        const unregister2 = pushBackHandler(() => { order.push(2); return true; });

        expect(getBackHandlerCount()).toBe(2);

        // Topmost is 2
        const handled1 = handleBack();
        expect(handled1).toBe(true);
        expect(order).toEqual([2]);

        // Unregister 2
        unregister2();
        expect(getBackHandlerCount()).toBe(1);

        // Next topmost is 1
        const handled2 = handleBack();
        expect(handled2).toBe(true);
        expect(order).toEqual([2, 1]);

        unregister1();
        expect(getBackHandlerCount()).toBe(0);

        const handled3 = handleBack();
        expect(handled3).toBe(false);
    });
});
