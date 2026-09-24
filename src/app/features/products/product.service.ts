import { Service, inject } from '@angular/core';
import {
  CreateProductRequest,
  Service as ApiClient,
  UpdateProductRequest,
} from '../../core/api/wms-api';

@Service()
export class ProductService {
  private readonly api = inject(ApiClient);

  getAll() {
    return this.api.productAll();
  }

  getPaged(pageNumber: number, pageSize: number) {
    return this.api.paged2(pageNumber, pageSize);
  }

  getById(id: number) {
    return this.api.productGET(id);
  }

  search(name: string) {
    return this.api.search(name);
  }

  byCategory(category: string) {
    return this.api.category(category);
  }

  create(body: CreateProductRequest) {
    return this.api.productPOST(body);
  }

  update(id: number, body: UpdateProductRequest) {
    return this.api.productPUT(id, body);
  }

  delete(id: number) {
    return this.api.productDELETE(id);
  }
}
