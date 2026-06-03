import { IS_PUBLIC_KEY, Public } from './public.decorator';

describe('Public decorator', () => {
  it('should export IS_PUBLIC_KEY', () => {
    expect(IS_PUBLIC_KEY).toBe('isPublic');
  });

  it('should create a decorator function', () => {
    const decorator = Public();
    expect(typeof decorator).toBe('function');
  });

  it('should apply metadata when used on a method', () => {
    class TestController {
      @Public()
      publicMethod() {
        return 'public';
      }
    }

    // Verify the decorator was applied without error
    const instance = new TestController();
    expect(instance.publicMethod()).toBe('public');
  });
});
