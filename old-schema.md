-- public."Product" definition

-- Drop table

-- DROP TABLE public."Product";

CREATE TABLE public."Product" (
	id serial4 NOT NULL,
	barcode text NULL,
	"name" text NOT NULL,
	description text NULL,
	"imageUrl" text NULL,
	price float8 NOT NULL,
	integration bool DEFAULT false NOT NULL,
	"categoryId" int4 NULL,
	"subCategoryId" int4 NULL,
	CONSTRAINT "Product_barcode_unique" UNIQUE (barcode),
	CONSTRAINT "Product_pkey" PRIMARY KEY (id)
);
CREATE INDEX "Product_barcode_idx" ON public."Product" USING btree (barcode);
CREATE UNIQUE INDEX "Product_barcode_key" ON public."Product" USING btree (barcode);


-- public."Product" foreign keys

ALTER TABLE public."Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE public."Product" ADD CONSTRAINT "Product_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES public."SubCategory"(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- public."Category" definition

-- Drop table

-- DROP TABLE public."Category";

CREATE TABLE public."Category" (
	id serial4 NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT "Category_pkey" PRIMARY KEY (id)
);

-- public."SubCategory" definition

-- Drop table

-- DROP TABLE public."SubCategory";

CREATE TABLE public."SubCategory" (
	id serial4 NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"categoryId" int4 NOT NULL,
	CONSTRAINT "SubCategory_pkey" PRIMARY KEY (id)
);


-- public."SubCategory" foreign keys

ALTER TABLE public."SubCategory" ADD CONSTRAINT "SubCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"(id) ON DELETE RESTRICT ON UPDATE CASCADE;