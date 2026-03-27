import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const categories = [
    {
      name: 'Mercearia',
      subCategories: [
        'Grãos',
        'Açucares e Adoçantes',
        'Acetos e Vinagres',
        'Achocolatados e Shakes',
        'Alimentação Infantil',
        'Bomboniere',
        'Chás e Cafés',
        'Confeitaria e Panificação',
        'Doces e Sobremesas',
        'Enlatados e Conservas',
        'Farináceos',
        'Gelatinas',
        'Geleias e Compotas',
        'Granolas e Cereais',
        'Leite em Pó e Compostos',
        'Massas Alimentícias',
        'Mistura para Bolo',
        'Molhos e Caldos',
        'Óleos e Azeites',
        'Produtos Étnicos',
        'Temperos e Condimentos',
      ],
    },
    {
      name: 'Higiene e Beleza',
      subCategories: [
        'Absorventes e Protetores Diários',
        'Barba e Depilação',
        'Coloração e Descolorantes',
        'Desodorantes',
        'Fralda Geriátrica',
        'Higiene Oral',
        'Lenços e Acessórios',
        'Para Os Cabelos',
        'Protetores e Bronzeadores',
        'Sabonetes',
        'Shampoo e Condicionador',
        'Cuidados com Rosto e Corpo',
        'Depilatórios e Manicure',
        'Farmácia e Cuidados Pessoais',
        'Manicure',
        'Papel Higiênico e Lenço de Papel',
      ],
    },
    {
      name: 'Limpeza',
      subCategories: [
        'Acessórios de Limpeza',
        'Água Sanitária e Alvejantes',
        'Aromatizantes e Purificadores',
        'Desinfetantes',
        'Inseticidas e Raticidas',
        'Lavanderia',
        'Limpadores',
        'Sabão e Detergente',
        'Saco Para Lixo',
      ],
    },
    {
      name: 'Laticínios e Frios',
      subCategories: [
        'Iogurtes e Fermentados',
        'Leites',
        'Manteigas e Margarinas',
        'Queijos',
        'Requeijão e Cremes',
        'Iogurte e bebida láctea',
        'Leite e Derivados',
      ],
    },
    {
      name: 'Pet Shop',
      subCategories: [
        'Alimentos Para Aves',
        'Alimentos Para Cães',
        'Alimentos Para Gatos',
        'Higiene e Acessórios',
      ],
    },
    {
      name: 'Bebidas Alcoólicas',
      subCategories: [
        'Aguardentes e Cachaças',
        'Bebidas Mistas',
        'Cervejas',
        'Espumantes e Frisantes',
        'Licores',
        'Run e Gin e Saquê',
        'Vinho Branco',
        'Vinho Do Porto',
        'Vinho Rosé',
        'Vinho Tinto',
        'Vodka',
        'Whisky',
        'Conhaque',
      ],
    },
    {
      name: 'Bebê',
      subCategories: ['Fraldas', 'Higiene', 'Mamãe', 'Pós Banho'],
    },
    {
      name: 'Utilidades e Bazar',
      subCategories: [
        'Artigos Para Festa',
        'Automotivo',
        'Banheiro',
        'Calçados',
        'Churrasco',
        'Descartáveis',
        'Eletro Portátil',
        'Ferramentas e Cia',
        'Floricultura e Jardinagem',
        'Papelaria',
        'Pilhas e Baterias e Lâmpadas',
        'Velas e Fósforos',
        'Casa e Utilidade',
        'Cozinha',
        'Eletricidade e Hidráulica',
        'Utilidade Doméstica',
      ],
    },
    {
      name: 'Bebidas',
      subCategories: [
        'Água De Coco',
        'Água Mineral',
        'Bebidas Vegetais',
        'Chás',
        'Energéticos e Isotônicos',
        'Refrigerantes',
        'Sucos e Refrescos',
      ],
    },
    {
      name: 'Biscoitos e Snacks',
      subCategories: [
        'Aperitivos',
        'Batatas e Salgadinhos',
        'Biscoitos e Bolachas',
        'Bomboniere',
        'Doces e Sobremesas',
        'Pipoca',
        'Bolos Industrializados',
      ],
    },
    {
      name: 'Congelados',
      subCategories: [
        'Polpa e Frutas',
        'Hambúrguer',
        'Tortas/Massas e Pratos Prontos',
        'Sorvete/Sobremesa/Gelo',
        'Lanches e Cia',
        'Linguiças e Salsichas',
        'Vegetais Congelados',
      ],
    },
  ];

  for (const cat of categories) {
    let category = await prisma.category.findFirst({
      where: { name: cat.name },
    });

    if (!category) {
      category = await prisma.category.create({
        data: { name: cat.name },
      });
    }

    for (const subName of cat.subCategories) {
      const existing = await prisma.subCategory.findFirst({
        where: { name: subName, categoryId: category.id },
      });

      if (!existing) {
        await prisma.subCategory.create({
          data: {
            name: subName,
            categoryId: category.id,
          },
        });
      }
    }

    console.log(
      `✓ ${category.name} (${cat.subCategories.length} subcategorias)`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
