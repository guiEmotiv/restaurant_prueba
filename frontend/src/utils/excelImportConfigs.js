// Configuration for Excel import templates and validation
export const EXCEL_IMPORT_CONFIGS = {
  units: {
    templateConfig: {
      columns: ['name'],
      examples: [
        ['kg'],
        ['litros'],  
        ['unidades'],
        ['metros'],
        ['piezas']
      ],
      filename: 'plantilla_unidades.xlsx'
    },
    formatDescription: [
      'El archivo debe tener una columna llamada "name"',
      'Cada fila debe contener el nombre de una unidad',
      'Se omitirán las filas vacías'
    ]
  },
  
  zones: {
    templateConfig: {
      columns: ['name'],
      examples: [
        ['Terraza'],
        ['Sala Principal'],
        ['Bar'],
        ['Área VIP'],
        ['Jardín']
      ],
      filename: 'plantilla_zonas.xlsx'
    },
    formatDescription: [
      'El archivo debe tener una columna llamada "name"',
      'Cada fila debe contener el nombre de una zona',
      'Se omitirán las filas vacías'
    ]
  },
  
  tables: {
    templateConfig: {
      columns: ['zone', 'table_number'],
      examples: [
        ['Terraza', 'T01'],
        ['Terraza', 'T02'],
        ['Sala Principal', 'S01'], 
        ['Bar', 'B01'],
        ['Área VIP', 'V01']
      ],
      filename: 'plantilla_mesas.xlsx'
    },
    formatDescription: [
      'El archivo debe tener las columnas "zone" y "table_number"',
      'La zona debe existir previamente en el sistema',
      'El número de mesa debe ser único',
      'Se omitirán las filas vacías'
    ]
  },
  
  containers: {
    templateConfig: {
      columns: ['name', 'price', 'description', 'stock'],
      examples: [
        ['Envase Pequeño', '2.50', 'Envase para porciones individuales', '100'],
        ['Envase Mediano', '3.00', 'Envase para porciones familiares', '75'],
        ['Envase Grande', '4.50', 'Envase para pedidos grandes', '50'],
        ['Bolsa Ecológica', '1.00', 'Bolsa biodegradable', '200']
      ],
      filename: 'plantilla_envases.xlsx'
    },
    formatDescription: [
      'Columnas requeridas: "name" y "price"',
      'Columnas opcionales: "description" y "stock"',
      'El precio debe ser un número mayor a 0',
      'El stock debe ser un número entero (por defecto 0)',
      'Se omitirán las filas vacías'
    ]
  },
  
  groups: {
    templateConfig: {
      columns: ['name'],
      examples: [
        ['Entradas'],
        ['Platos Principales'],
        ['Postres'],
        ['Bebidas'],
        ['Especialidades']
      ],
      filename: 'plantilla_grupos.xlsx'
    },
    formatDescription: [
      'El archivo debe tener una columna llamada "name"',
      'Cada fila debe contener el nombre de un grupo',
      'Se omitirán las filas vacías'
    ]
  },
  
  ingredients: {
    templateConfig: {
      columns: ['unit', 'name', 'unit_price', 'current_stock'],
      examples: [
        ['kg', 'Pollo', '8.50', '25.0'],
        ['litros', 'Aceite de Oliva', '15.00', '5.0'],
        ['unidades', 'Huevos', '0.30', '100'],
        ['kg', 'Arroz', '3.20', '50.0'],
        ['litros', 'Leche', '4.50', '10.0']
      ],
      filename: 'plantilla_ingredientes.xlsx'
    },
    formatDescription: [
      'Columnas requeridas: "unit", "name" y "unit_price"',
      'Columna opcional: "current_stock" (por defecto 0)',
      'La unidad debe existir previamente en el sistema',
      'El precio unitario debe ser mayor a 0',
      'El stock actual debe ser 0 o mayor',
      'Se omitirán las filas vacías'
    ]
  },
  
  recipes: {
    templateConfig: {
      columns: [
        'name', 'version', 'group', 'container', 
        'profit_percentage', 'preparation_time', 
        'ingredient_1', 'quantity_1', 'ingredient_2', 'quantity_2', 
        'ingredient_3', 'quantity_3', 'ingredient_4', 'quantity_4',
        'ingredient_5', 'quantity_5', 'ingredient_6', 'quantity_6',
        'ingredient_7', 'quantity_7', 'ingredient_8', 'quantity_8'
      ],
      examples: [
        [
          'Arroz con Pollo', '1.0', 'Platos Principales', 'Envase Mediano', 
          '15.0', '25', 'Pollo', '0.5', 'Arroz', '0.2', 'Aceite de Oliva', '0.05', '', '', '', '', '', '', '', ''
        ],
        [
          'Ensalada César', '1.0', 'Entradas', 'Envase Pequeño', 
          '20.0', '10', 'Lechuga', '0.1', 'Huevos', '2', 'Aceite de Oliva', '0.03', '', '', '', '', '', '', '', ''
        ],
        [
          'Tiramisu', '1.0', 'Postres', 'Envase Pequeño', 
          '25.0', '5', 'Leche', '0.2', 'Huevos', '1', '', '', '', '', '', '', '', '', '', ''
        ],
        [
          'Lomo Saltado', '1.0', 'Platos Principales', 'Envase Grande', 
          '18.0', '20', 'Pollo', '0.3', 'Arroz', '0.15', 'Aceite de Oliva', '0.04', 'Cebolla', '0.1', '', '', '', '', '', ''
        ]
      ],
      filename: 'plantilla_recetas.xlsx'
    },
    formatDescription: [
      'Columnas requeridas: "name" y al menos un ingrediente',
      'Columnas opcionales: "version" (por defecto 1.0), "group", "container", "profit_percentage" (por defecto 0), "preparation_time" (por defecto 10)',
      'PRECIO BASE: Se calcula automáticamente usando: (Costo ingredientes) × (1 + profit_percentage/100)',
      'Ingredientes: Use pares de columnas "ingredient_X" y "quantity_X" (hasta 8 ingredientes por receta)',
      'Ejemplo: ingredient_1="Pollo", quantity_1="0.5", ingredient_2="Arroz", quantity_2="0.2"',
      'Los ingredientes deben existir previamente en el sistema',
      'Las cantidades deben ser números positivos',
      'El grupo y envase deben existir previamente (si se especifican)',
      'Deje vacías las columnas de ingredientes no utilizadas',
      'Se omitirán las filas vacías'
    ]
  }
};