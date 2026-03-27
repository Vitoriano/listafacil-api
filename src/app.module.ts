import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { StoresModule } from './stores/stores.module';
import { PricesModule } from './prices/prices.module';
import { ListsModule } from './lists/lists.module';
import { PurchasesModule } from './purchases/purchases.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    CoreModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    CategoriesModule,
    StoresModule,
    PricesModule,
    ListsModule,
    PurchasesModule,
    HealthModule,
  ],
})
export class AppModule {}
