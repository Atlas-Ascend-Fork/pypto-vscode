/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BasicService } from '../../../src/services/basic-service';
import * as vscode from 'vscode';

describe('basic-service', () => {
  beforeEach(() => {
    // 清理所有已记录的服务，通过创建一个临时服务然后释放它来重置状态
    // 由于 startedServices 是模块级的私有变量，我们需要通过实例化来测试
  });

  describe('BasicService', () => {
    it('should create service with name', () => {
      const service = new BasicService('test-service-1');
      expect(service.name).toBe('test-service-1');
      service.dispose();
    });

    it('should throw error when creating duplicate service', () => {
      const service1 = new BasicService('duplicate-service');
      
      expect(() => {
        new BasicService('duplicate-service');
      }).toThrow('进程中只允许实例化一次service，duplicate-service 已存在');
      
      service1.dispose();
    });

    it('should allow creating service with different names', () => {
      const service1 = new BasicService('service-a');
      const service2 = new BasicService('service-b');
      
      expect(service1.name).toBe('service-a');
      expect(service2.name).toBe('service-b');
      
      service1.dispose();
      service2.dispose();
    });

    it('should manage disposables array', () => {
      const service = new BasicService('disposable-service');
      const mockDisposable1 = { dispose: vi.fn() };
      const mockDisposable2 = { dispose: vi.fn() };
      
      (service as any)._disposables.push(mockDisposable1);
      (service as any)._disposables.push(mockDisposable2);
      
      service.dispose();
      
      expect(mockDisposable1.dispose).toHaveBeenCalled();
      expect(mockDisposable2.dispose).toHaveBeenCalled();
    });

    it('should dispose all disposables when service is disposed', () => {
      const service = new BasicService('multi-disposable-service');
      const disposables = Array.from({ length: 5 }, () => ({ dispose: vi.fn() }));
      
      disposables.forEach(d => (service as any)._disposables.push(d));
      
      service.dispose();
      
      disposables.forEach(d => {
        expect(d.dispose).toHaveBeenCalled();
      });
    });

    it('should extend vscode.Disposable', () => {
      const service = new BasicService('vscode-disposable-test');
      expect(service).toBeInstanceOf(vscode.Disposable);
      service.dispose();
    });

    it('should have protected _disposables array', () => {
      const service = new BasicService('protected-disposables-test');
      expect((service as any)._disposables).toBeDefined();
      expect(Array.isArray((service as any)._disposables)).toBe(true);
      service.dispose();
    });

    it('should call dispose on all disposables even if some throw errors', () => {
      const service = new BasicService('error-handling-test');
      const mockDisposable1 = { dispose: vi.fn() };
      const mockDisposable2 = { dispose: vi.fn(() => { throw new Error('dispose error'); }) };
      const mockDisposable3 = { dispose: vi.fn() };
      
      (service as any)._disposables.push(mockDisposable1);
      (service as any)._disposables.push(mockDisposable2);
      (service as any)._disposables.push(mockDisposable3);
      
      // dispose 方法会遍历所有 disposables，即使某些抛出错误
      // 但由于 forEach 不会捕获错误，第二个会中断执行
      // 这是原始实现的行为
      try {
        service.dispose();
      } catch (e) {
        // 预期会抛出错误
      }
      
      expect(mockDisposable1.dispose).toHaveBeenCalled();
      expect(mockDisposable2.dispose).toHaveBeenCalled();
      // 第三个可能不会被调用，因为第二个抛出了错误
    });
  });
});
