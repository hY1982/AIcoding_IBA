import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentUser } from './current-user.decorator';

describe('CurrentUser decorator', () => {
  it('should be defined as a function', () => {
    expect(CurrentUser).toBeDefined();
    expect(typeof CurrentUser).toBe('function');
  });

  it('should apply parameter metadata when used on a method argument', () => {
    class TestController {
      testMethod(@CurrentUser() user: any) {
        return user;
      }
    }

    const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestController, 'testMethod');
    expect(metadata).toBeDefined();
    expect(typeof metadata).toBe('object');
  });

  it('should extract user from request via the embedded factory function', () => {
    const mockUser = { userId: 1, phone: '13800138000', userType: 'player' };
    const mockRequest = { user: mockUser };

    const mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as ExecutionContext;

    // Apply decorator to a method so the factory is stored in metadata
    class TestController {
      testMethod(@CurrentUser() _user: any) {
        return _user;
      }
    }

    const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestController, 'testMethod');
    expect(metadata).toBeDefined();

    // Find the factory function in metadata and invoke it
    const metadataKey = Object.keys(metadata)[0];
    const factory = metadata[metadataKey].factory;
    expect(typeof factory).toBe('function');

    const result = factory(undefined, mockExecutionContext);
    expect(result).toEqual(mockUser);
  });

  it('should throw UnauthorizedException when user is not authenticated', () => {
    const mockRequest = { user: undefined };

    const mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as ExecutionContext;

    class TestController {
      testMethod(@CurrentUser() _user: any) {
        return _user;
      }
    }

    const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestController, 'testMethod');
    const metadataKey = Object.keys(metadata)[0];
    const factory = metadata[metadataKey].factory;

    expect(() => factory(undefined, mockExecutionContext)).toThrow(UnauthorizedException);
  });
});
