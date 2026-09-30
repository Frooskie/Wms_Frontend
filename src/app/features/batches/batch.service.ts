import { Service, inject } from '@angular/core';
import {
  CreateBatchRequest,
  MoveBatchRequest,
  Service as ApiClient,
} from '../../core/api/wms-api';

/**
 * Фильтры списка партий.
 */
export interface BatchFilters {
  productId?: number;
  cellId?: number;
  expiryFrom?: string;
  expiryTo?: string;
}

@Service()
export class BatchService {
  private readonly api = inject(ApiClient);

  getPaged(filters: BatchFilters, pageNumber: number, pageSize: number) {
    return this.api.batchGET(
      filters.productId,
      filters.cellId,
      filters.expiryFrom,
      filters.expiryTo,
      pageNumber,
      pageSize,
    );
  }

  getById(id: number) {
    return this.api.batchGET2(id);
  }

  create(body: CreateBatchRequest) {
    return this.api.batchPOST(body);
  }

  move(id: number, body: MoveBatchRequest) {
    return this.api.move(id, body);
  }
}
