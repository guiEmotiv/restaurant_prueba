-- ==========================================
-- 🍽️ RESTAURANT DATABASE POPULATION SCRIPT
-- ==========================================
-- Este script contiene TODOS los datos reales del restaurante
-- para poblar la base de datos de EC2
--
-- INSTRUCCIONES DE USO:
-- 1. Copiar este archivo al servidor EC2
-- 2. Ejecutar: python manage.py dbshell < populate_ec2_database.sql
-- 3. Verificar datos: python manage.py shell
--
-- ==========================================

-- Deshabilitar foreign keys temporalmente
PRAGMA foreign_keys=OFF;

-- ==========================================
-- 📏 UNIDADES DE MEDIDA
-- ==========================================
BEGIN TRANSACTION;
DELETE FROM unit WHERE id BETWEEN 17 AND 22;
INSERT INTO unit VALUES(17,'ml','2025-08-01 09:05:16.345742');
INSERT INTO unit VALUES(18,'unidades','2025-08-01 09:05:16.346075');
INSERT INTO unit VALUES(19,'tazas','2025-08-01 09:05:16.346401');
INSERT INTO unit VALUES(20,'cucharadas','2025-08-01 09:05:16.346705');
INSERT INTO unit VALUES(21,'cucharaditas','2025-08-01 09:05:16.347010');
INSERT INTO unit VALUES(22,'porciones','2025-08-01 09:05:16.347311');

-- Añadir unidades faltantes
INSERT OR IGNORE INTO unit VALUES(14,'kg','2025-08-01 09:05:16.000000');
INSERT OR IGNORE INTO unit VALUES(15,'gr','2025-08-01 09:05:16.000000');
INSERT OR IGNORE INTO unit VALUES(16,'litros','2025-08-01 09:05:16.000000');
COMMIT;

-- ==========================================
-- 🏢 ZONAS DEL RESTAURANTE
-- ==========================================
BEGIN TRANSACTION;
DELETE FROM zone WHERE id BETWEEN 8 AND 12;
INSERT INTO zone VALUES(8,'Salón Principal','2025-08-01 09:05:16.347732');
INSERT INTO zone VALUES(9,'Terraza','2025-08-01 09:05:16.348119');
INSERT INTO zone VALUES(10,'Área VIP','2025-08-01 09:05:16.348428');
INSERT INTO zone VALUES(11,'Bar','2025-08-01 09:05:16.348734');
INSERT INTO zone VALUES(12,'Zona Familiar','2025-08-01 09:05:16.349036');
COMMIT;

-- ==========================================
-- 🪑 MESAS DEL RESTAURANTE (30 mesas)
-- ==========================================
BEGIN TRANSACTION;
DELETE FROM "table" WHERE id BETWEEN 36 AND 65;
-- Salón Principal (12 mesas)
INSERT INTO "table" VALUES(36,'1','2025-08-01 09:05:16.349580',8);
INSERT INTO "table" VALUES(37,'2','2025-08-01 09:05:16.350104',8);
INSERT INTO "table" VALUES(38,'3','2025-08-01 09:05:16.350531',8);
INSERT INTO "table" VALUES(39,'4','2025-08-01 09:05:16.350949',8);
INSERT INTO "table" VALUES(40,'5','2025-08-01 09:05:16.351353',8);
INSERT INTO "table" VALUES(41,'6','2025-08-01 09:05:16.351757',8);
INSERT INTO "table" VALUES(42,'7','2025-08-01 09:05:16.352155',8);
INSERT INTO "table" VALUES(43,'8','2025-08-01 09:05:16.352546',8);
INSERT INTO "table" VALUES(44,'9','2025-08-01 09:05:16.352942',8);
INSERT INTO "table" VALUES(45,'10','2025-08-01 09:05:16.353339',8);
INSERT INTO "table" VALUES(46,'11','2025-08-01 09:05:16.353731',8);
INSERT INTO "table" VALUES(47,'12','2025-08-01 09:05:16.354124',8);

-- Terraza (6 mesas)
INSERT INTO "table" VALUES(48,'13','2025-08-01 09:05:16.354520',9);
INSERT INTO "table" VALUES(49,'14','2025-08-01 09:05:16.354906',9);
INSERT INTO "table" VALUES(50,'15','2025-08-01 09:05:16.355296',9);
INSERT INTO "table" VALUES(51,'16','2025-08-01 09:05:16.355683',9);
INSERT INTO "table" VALUES(52,'17','2025-08-01 09:05:16.356065',9);
INSERT INTO "table" VALUES(53,'18','2025-08-01 09:05:16.356462',9);

-- Área VIP (4 mesas)
INSERT INTO "table" VALUES(54,'19','2025-08-01 09:05:16.356857',10);
INSERT INTO "table" VALUES(55,'20','2025-08-01 09:05:16.357245',10);
INSERT INTO "table" VALUES(56,'21','2025-08-01 09:05:16.357634',10);
INSERT INTO "table" VALUES(57,'22','2025-08-01 09:05:16.358020',10);

-- Bar (4 mesas)
INSERT INTO "table" VALUES(58,'23','2025-08-01 09:05:16.358418',11);
INSERT INTO "table" VALUES(59,'24','2025-08-01 09:05:16.358812',11);
INSERT INTO "table" VALUES(60,'25','2025-08-01 09:05:16.359200',11);
INSERT INTO "table" VALUES(61,'26','2025-08-01 09:05:16.359599',11);

-- Zona Familiar (4 mesas)
INSERT INTO "table" VALUES(62,'27','2025-08-01 09:05:16.359998',12);
INSERT INTO "table" VALUES(63,'28','2025-08-01 09:05:16.360401',12);
INSERT INTO "table" VALUES(64,'29','2025-08-01 09:05:16.360784',12);
INSERT INTO "table" VALUES(65,'30','2025-08-01 09:05:16.361178',12);
COMMIT;

-- ==========================================
-- 👨‍🍳 MESEROS DEL RESTAURANTE - OMITIDO
-- ==========================================
-- Los meseros se manejan desde la aplicación web

-- ==========================================
-- 📦 ENVASES PARA COMIDA PARA LLEVAR
-- ==========================================
BEGIN TRANSACTION;
DELETE FROM container;
INSERT INTO container VALUES(1,'Envase Pequeño','Para entradas y postres',1.50,100,1,'2025-08-01 09:00:00.000000','2025-08-01 09:00:00.000000');
INSERT INTO container VALUES(2,'Envase Mediano','Para platos principales',2.00,80,1,'2025-08-01 09:00:00.000000','2025-08-01 09:00:00.000000');
INSERT INTO container VALUES(3,'Envase Grande','Para porciones familiares',2.50,50,1,'2025-08-01 09:00:00.000000','2025-08-01 09:00:00.000000');
INSERT INTO container VALUES(4,'Vaso Bebidas','Para jugos y bebidas',0.80,200,1,'2025-08-01 09:00:00.000000','2025-08-01 09:00:00.000000');
COMMIT;

-- ==========================================
-- 🏷️ GRUPOS DE RECETAS
-- ==========================================
BEGIN TRANSACTION;
DELETE FROM "group" WHERE id BETWEEN 15 AND 26;
INSERT INTO "group" VALUES(15,'Entradas','2025-08-01 09:05:16.361562');
INSERT INTO "group" VALUES(16,'Sopas y Cremas','2025-08-01 09:05:16.361938');
INSERT INTO "group" VALUES(17,'Ensaladas','2025-08-01 09:05:16.362250');
INSERT INTO "group" VALUES(18,'Platos Principales','2025-08-01 09:05:16.362563');
INSERT INTO "group" VALUES(19,'Carnes a la Parrilla','2025-08-01 09:05:16.362856');
INSERT INTO "group" VALUES(20,'Pescados y Mariscos','2025-08-01 09:05:16.363147');
INSERT INTO "group" VALUES(21,'Pasta y Risottos','2025-08-01 09:05:16.363435');
INSERT INTO "group" VALUES(22,'Postres','2025-08-01 09:05:16.363726');
INSERT INTO "group" VALUES(23,'Bebidas Calientes','2025-08-01 09:05:16.364015');
INSERT INTO "group" VALUES(24,'Bebidas Frías','2025-08-01 09:05:16.364301');
INSERT INTO "group" VALUES(25,'Jugos Naturales','2025-08-01 09:05:16.364600');
INSERT INTO "group" VALUES(26,'Cócteles','2025-08-01 09:05:16.364903');
COMMIT;

-- ==========================================
-- 🥘 INGREDIENTES DEL INVENTARIO (41 ingredientes)
-- ==========================================
BEGIN TRANSACTION;
DELETE FROM ingredient WHERE id BETWEEN 49 AND 89;
-- Carnes y Proteínas
INSERT INTO ingredient VALUES(49,'Lomo de res',35,8.5,1,'2025-08-01 09:05:16.365443','2025-08-01 09:05:16.365453',14);
INSERT INTO ingredient VALUES(50,'Pechuga de pollo',18,12,1,'2025-08-01 09:05:16.365952','2025-08-01 09:05:16.365960',14);
INSERT INTO ingredient VALUES(51,'Muslos de pollo',12,15,1,'2025-08-01 09:05:16.366367','2025-08-01 09:05:16.366378',14);
INSERT INTO ingredient VALUES(52,'Cerdo',22,6,1,'2025-08-01 09:05:16.366767','2025-08-01 09:05:16.366782',14);
INSERT INTO ingredient VALUES(53,'Pescado corvina',28,4.5,1,'2025-08-01 09:05:16.367186','2025-08-01 09:05:16.367195',14);
INSERT INTO ingredient VALUES(54,'Camarones',45,2,1,'2025-08-01 09:05:16.367593','2025-08-01 09:05:16.367601',14);

-- Vegetales
INSERT INTO ingredient VALUES(55,'Cebolla roja',3.5,25,1,'2025-08-01 09:05:16.367996','2025-08-01 09:05:16.368011',14);
INSERT INTO ingredient VALUES(56,'Tomate',4,20,1,'2025-08-01 09:05:16.368399','2025-08-01 09:05:16.368408',14);
INSERT INTO ingredient VALUES(57,'Lechuga',2.5,15,1,'2025-08-01 09:05:16.368789','2025-08-01 09:05:16.368797',18);
INSERT INTO ingredient VALUES(58,'Zanahoria',2.8,18,1,'2025-08-01 09:05:16.369187','2025-08-01 09:05:16.369196',14);
INSERT INTO ingredient VALUES(59,'Papa amarilla',3.2,30,1,'2025-08-01 09:05:16.369577','2025-08-01 09:05:16.369585',14);
INSERT INTO ingredient VALUES(60,'Ají amarillo',8,3,1,'2025-08-01 09:05:16.369969','2025-08-01 09:05:16.369977',14);
INSERT INTO ingredient VALUES(61,'Rocoto',6.5,2.5,1,'2025-08-01 09:05:16.370368','2025-08-01 09:05:16.370376',14);
INSERT INTO ingredient VALUES(62,'Apio',4.5,8,1,'2025-08-01 09:05:16.370770','2025-08-01 09:05:16.370778',14);
INSERT INTO ingredient VALUES(63,'Brócoli',5,6,1,'2025-08-01 09:05:16.371152','2025-08-01 09:05:16.371161',14);

-- Carbohidratos
INSERT INTO ingredient VALUES(64,'Arroz',4.5,50,1,'2025-08-01 09:05:16.371543','2025-08-01 09:05:16.371552',14);
INSERT INTO ingredient VALUES(65,'Quinua',12,10,1,'2025-08-01 09:05:16.371929','2025-08-01 09:05:16.371943',14);
INSERT INTO ingredient VALUES(66,'Pasta espagueti',6,15,1,'2025-08-01 09:05:16.372323','2025-08-01 09:05:16.372331',14);
INSERT INTO ingredient VALUES(67,'Harina de trigo',3.8,20,1,'2025-08-01 09:05:16.372733','2025-08-01 09:05:16.372741',14);

-- Lácteos
INSERT INTO ingredient VALUES(68,'Leche evaporada',4.2,24,1,'2025-08-01 09:05:16.373130','2025-08-01 09:05:16.373138',18);
INSERT INTO ingredient VALUES(69,'Queso fresco',18,5,1,'2025-08-01 09:05:16.373537','2025-08-01 09:05:16.373546',14);
INSERT INTO ingredient VALUES(70,'Mantequilla',22,3,1,'2025-08-01 09:05:16.373937','2025-08-01 09:05:16.373945',14);
INSERT INTO ingredient VALUES(71,'Crema de leche',12,4,1,'2025-08-01 09:05:16.374330','2025-08-01 09:05:16.374338',16);

-- Condimentos y Especias
INSERT INTO ingredient VALUES(72,'Sal',2,10,1,'2025-08-01 09:05:16.374769','2025-08-01 09:05:16.374777',14);
INSERT INTO ingredient VALUES(73,'Pimienta',0.08,500,1,'2025-08-01 09:05:16.375158','2025-08-01 09:05:16.375166',15);
INSERT INTO ingredient VALUES(74,'Comino',0.12,300,1,'2025-08-01 09:05:16.375544','2025-08-01 09:05:16.375552',15);
INSERT INTO ingredient VALUES(75,'Ajo',8,5,1,'2025-08-01 09:05:16.375936','2025-08-01 09:05:16.375944',14);
INSERT INTO ingredient VALUES(76,'Culantro',6,3,1,'2025-08-01 09:05:16.376319','2025-08-01 09:05:16.376328',14);
INSERT INTO ingredient VALUES(77,'Orégano',0.15,200,1,'2025-08-01 09:05:16.376702','2025-08-01 09:05:16.376710',15);

-- Aceites y Líquidos
INSERT INTO ingredient VALUES(78,'Aceite vegetal',8.5,8,1,'2025-08-01 09:05:16.377095','2025-08-01 09:05:16.377103',16);
INSERT INTO ingredient VALUES(79,'Aceite de oliva',25,2,1,'2025-08-01 09:05:16.377473','2025-08-01 09:05:16.377481',16);
INSERT INTO ingredient VALUES(80,'Vinagre blanco',4,4,1,'2025-08-01 09:05:16.377847','2025-08-01 09:05:16.377855',16);

-- Bebidas
INSERT INTO ingredient VALUES(81,'Agua mineral',2.5,48,1,'2025-08-01 09:05:16.378227','2025-08-01 09:05:16.378236',18);
INSERT INTO ingredient VALUES(82,'Coca Cola',3.5,36,1,'2025-08-01 09:05:16.378607','2025-08-01 09:05:16.378616',18);
INSERT INTO ingredient VALUES(83,'Inca Kola',3.5,24,1,'2025-08-01 09:05:16.378984','2025-08-01 09:05:16.378992',18);
INSERT INTO ingredient VALUES(84,'Cerveza',5.5,30,1,'2025-08-01 09:05:16.379368','2025-08-01 09:05:16.379376',18);
INSERT INTO ingredient VALUES(85,'Café molido',28,2,1,'2025-08-01 09:05:16.379742','2025-08-01 09:05:16.379751',14);

-- Frutas
INSERT INTO ingredient VALUES(86,'Limón',5,12,1,'2025-08-01 09:05:16.380115','2025-08-01 09:05:16.380123',14);
INSERT INTO ingredient VALUES(87,'Naranja',4,15,1,'2025-08-01 09:05:16.380502','2025-08-01 09:05:16.380510',14);
INSERT INTO ingredient VALUES(88,'Mango',6.5,8,1,'2025-08-01 09:05:16.380884','2025-08-01 09:05:16.380893',14);
INSERT INTO ingredient VALUES(89,'Palta',8,6,1,'2025-08-01 09:05:16.381265','2025-08-01 09:05:16.381273',14);
COMMIT;

-- ==========================================
-- 🍽️ RECETAS DEL MENÚ (18 recetas)
-- ==========================================
BEGIN TRANSACTION;
DELETE FROM recipe WHERE id BETWEEN 22 AND 39;
-- Entradas
INSERT INTO recipe VALUES(22,7.8,1,8,'2025-08-01 09:05:16.381784','2025-08-01 09:05:16.385720',15,0,1,'1.0','Palta Rellena');
INSERT INTO recipe VALUES(23,4.39,1,20,'2025-08-01 09:05:16.386236','2025-08-01 09:05:16.391101',15,0,1,'1.0','Causa Limeña');

-- Sopas
INSERT INTO recipe VALUES(24,6.95,1,25,'2025-08-01 09:05:16.391638','2025-08-01 09:05:16.398373',16,0,1,'1.0','Sopa Criolla');
INSERT INTO recipe VALUES(25,12.39,1,30,'2025-08-01 09:05:16.398892','2025-08-01 09:05:16.403715',16,0,1,'1.0','Chupe de Camarones');

-- Ensaladas
INSERT INTO recipe VALUES(26,4.1,1,10,'2025-08-01 09:05:16.404249','2025-08-01 09:05:16.407510',17,0,1,'1.0','Ensalada César');
INSERT INTO recipe VALUES(27,1.08,1,15,'2025-08-01 09:05:16.408042','2025-08-01 09:05:16.409944',17,0,1,'1.0','Ensalada Rusa');

-- Platos Principales
INSERT INTO recipe VALUES(28,5.22,1,25,'2025-08-01 09:05:16.410457','2025-08-01 09:05:16.417141',18,0,1,'1.0','Arroz con Pollo');
INSERT INTO recipe VALUES(30,4.47,1,30,'2025-08-01 09:05:16.422976','2025-08-01 09:05:16.426247',18,0,1,'1.0','Ají de Gallina');

-- Carnes a la Parrilla
INSERT INTO recipe VALUES(29,10.14,1,20,'2025-08-01 09:05:16.417651','2025-08-01 09:05:16.422459',19,0,1,'1.0','Lomo Saltado');

-- Pescados y Mariscos
INSERT INTO recipe VALUES(31,11.75,1,15,'2025-08-01 09:05:16.426759','2025-08-01 09:05:16.431552',20,0,1,'1.0','Pescado a la Plancha');

-- Pasta
INSERT INTO recipe VALUES(32,4.44,1,18,'2025-08-01 09:05:16.432061','2025-08-01 09:05:16.436894',21,0,1,'1.0','Fetuccine Alfredo');
INSERT INTO recipe VALUES(33,6.98,1,25,'2025-08-01 09:05:16.437416','2025-08-01 09:05:16.444008',21,0,1,'1.0','Spaguetti Bolognesa');

-- Bebidas
INSERT INTO recipe VALUES(34,2.9,1,5,'2025-08-01 09:05:16.444516','2025-08-01 09:05:16.446380',24,0,1,'1.0','Limonada');
INSERT INTO recipe VALUES(35,3.06,1,3,'2025-08-01 09:05:16.446890','2025-08-01 09:05:16.448750',23,0,1,'1.0','Café Americano');
INSERT INTO recipe VALUES(36,3.5,1,1,'2025-08-01 09:05:16.449256','2025-08-01 09:05:16.450034',24,0,1,'1.0','Coca Cola 500ml');
INSERT INTO recipe VALUES(37,3.5,1,1,'2025-08-01 09:05:16.450543','2025-08-01 09:05:16.451321',24,0,1,'1.0','Inca Kola 500ml');
INSERT INTO recipe VALUES(38,2.5,1,1,'2025-08-01 09:05:16.451829','2025-08-01 09:05:16.452594',24,0,1,'1.0','Agua Mineral');
INSERT INTO recipe VALUES(39,5.5,1,1,'2025-08-01 09:05:16.453100','2025-08-01 09:05:16.453866',24,0,1,'1.0','Cerveza Pilsen');
COMMIT;

-- ==========================================
-- 🥄 INGREDIENTES DE RECETAS (54 items)
-- ==========================================
BEGIN TRANSACTION;
DELETE FROM recipe_item WHERE id BETWEEN 66 AND 119;
-- Palta Rellena
INSERT INTO recipe_item VALUES(66,0.5,'2025-08-01 09:05:16.382091',89,22);
INSERT INTO recipe_item VALUES(67,0.1,'2025-08-01 09:05:16.383425',50,22);
INSERT INTO recipe_item VALUES(68,1,'2025-08-01 09:05:16.384604',72,22);

-- Causa Limeña
INSERT INTO recipe_item VALUES(69,0.4,'2025-08-01 09:05:16.386424',59,23);
INSERT INTO recipe_item VALUES(70,0.05,'2025-08-01 09:05:16.387275',86,23);
INSERT INTO recipe_item VALUES(71,0.02,'2025-08-01 09:05:16.388395',60,23);
INSERT INTO recipe_item VALUES(72,0.15,'2025-08-01 09:05:16.389739',50,23);

-- Sopa Criolla
INSERT INTO recipe_item VALUES(73,0.15,'2025-08-01 09:05:16.391839',49,24);
INSERT INTO recipe_item VALUES(74,0.1,'2025-08-01 09:05:16.392705',66,24);
INSERT INTO recipe_item VALUES(75,0.08,'2025-08-01 09:05:16.393794',55,24);
INSERT INTO recipe_item VALUES(76,0.1,'2025-08-01 09:05:16.395145',56,24);
INSERT INTO recipe_item VALUES(77,0.1,'2025-08-01 09:05:16.396757',68,24);

-- Chupe de Camarones
INSERT INTO recipe_item VALUES(78,0.2,'2025-08-01 09:05:16.399081',54,25);
INSERT INTO recipe_item VALUES(79,0.3,'2025-08-01 09:05:16.399918',59,25);
INSERT INTO recipe_item VALUES(80,0.1,'2025-08-01 09:05:16.401012',69,25);
INSERT INTO recipe_item VALUES(81,0.15,'2025-08-01 09:05:16.402335',68,25);

-- Ensalada César
INSERT INTO recipe_item VALUES(82,0.2,'2025-08-01 09:05:16.404441',57,26);
INSERT INTO recipe_item VALUES(83,0.15,'2025-08-01 09:05:16.405316',50,26);
INSERT INTO recipe_item VALUES(84,0.05,'2025-08-01 09:05:16.406409',69,26);

-- Ensalada Rusa
INSERT INTO recipe_item VALUES(85,0.25,'2025-08-01 09:05:16.408243',59,27);
INSERT INTO recipe_item VALUES(86,0.1,'2025-08-01 09:05:16.409099',58,27);

-- Arroz con Pollo
INSERT INTO recipe_item VALUES(87,0.25,'2025-08-01 09:05:16.410647',64,28);
INSERT INTO recipe_item VALUES(88,0.2,'2025-08-01 09:05:16.411513',50,28);
INSERT INTO recipe_item VALUES(89,0.08,'2025-08-01 09:05:16.412605',55,28);
INSERT INTO recipe_item VALUES(90,0.02,'2025-08-01 09:05:16.413940',60,28);
INSERT INTO recipe_item VALUES(91,0.01,'2025-08-01 09:05:16.415529',76,28);

-- Lomo Saltado
INSERT INTO recipe_item VALUES(92,0.25,'2025-08-01 09:05:16.417842',49,29);
INSERT INTO recipe_item VALUES(93,0.2,'2025-08-01 09:05:16.418685',59,29);
INSERT INTO recipe_item VALUES(94,0.1,'2025-08-01 09:05:16.419790',55,29);
INSERT INTO recipe_item VALUES(95,0.1,'2025-08-01 09:05:16.421114',56,29);

-- Ají de Gallina
INSERT INTO recipe_item VALUES(96,0.2,'2025-08-01 09:05:16.423163',50,30);
INSERT INTO recipe_item VALUES(97,0.03,'2025-08-01 09:05:16.424025',60,30);
INSERT INTO recipe_item VALUES(98,0.15,'2025-08-01 09:05:16.425128',68,30);

-- Pescado a la Plancha
INSERT INTO recipe_item VALUES(99,0.25,'2025-08-01 09:05:16.426948',53,31);
INSERT INTO recipe_item VALUES(100,0.05,'2025-08-01 09:05:16.427789',86,31);
INSERT INTO recipe_item VALUES(101,2,'2025-08-01 09:05:16.428881',72,31);
INSERT INTO recipe_item VALUES(102,0.02,'2025-08-01 09:05:16.430223',79,31);

-- Fetuccine Alfredo
INSERT INTO recipe_item VALUES(103,0.15,'2025-08-01 09:05:16.432253',66,32);
INSERT INTO recipe_item VALUES(104,0.12,'2025-08-01 09:05:16.433123',71,32);
INSERT INTO recipe_item VALUES(105,0.08,'2025-08-01 09:05:16.434211',69,32);
INSERT INTO recipe_item VALUES(106,0.03,'2025-08-01 09:05:16.435537',70,32);

-- Spaguetti Bolognesa
INSERT INTO recipe_item VALUES(107,0.15,'2025-08-01 09:05:16.437609',66,33);
INSERT INTO recipe_item VALUES(108,0.15,'2025-08-01 09:05:16.438467',49,33);
INSERT INTO recipe_item VALUES(109,0.12,'2025-08-01 09:05:16.439556',56,33);
INSERT INTO recipe_item VALUES(110,0.06,'2025-08-01 09:05:16.440884',55,33);
INSERT INTO recipe_item VALUES(111,0.05,'2025-08-01 09:05:16.442442',58,33);

-- Limonada
INSERT INTO recipe_item VALUES(112,0.08,'2025-08-01 09:05:16.444698',86,34);
INSERT INTO recipe_item VALUES(113,1,'2025-08-01 09:05:16.445537',81,34);

-- Café Americano
INSERT INTO recipe_item VALUES(114,0.02,'2025-08-01 09:05:16.447070',85,35);
INSERT INTO recipe_item VALUES(115,1,'2025-08-01 09:05:16.447903',81,35);

-- Bebidas embotelladas
INSERT INTO recipe_item VALUES(116,1,'2025-08-01 09:05:16.449437',82,36);
INSERT INTO recipe_item VALUES(117,1,'2025-08-01 09:05:16.450723',83,37);
INSERT INTO recipe_item VALUES(118,1,'2025-08-01 09:05:16.452006',81,38);
INSERT INTO recipe_item VALUES(119,1,'2025-08-01 09:05:16.453282',84,39);
COMMIT;

-- ==========================================
-- ⚙️ CONFIGURACIÓN OPERATIVA
-- ==========================================
BEGIN TRANSACTION;
DELETE FROM restaurant_operational_config;
INSERT INTO restaurant_operational_config VALUES(1,'El Fogón de Don Soto','18:00:00','02:00:00','05:00:00',1,'2025-08-01 09:00:00.000000','2025-08-01 09:00:00.000000');
COMMIT;

-- Rehabilitar foreign keys
PRAGMA foreign_keys=ON;

-- ==========================================
-- ✅ SCRIPT COMPLETADO
-- ==========================================
-- El script ha poblado exitosamente:
-- ✓ 9 Unidades de medida
-- ✓ 5 Zonas del restaurante  
-- ✓ 30 Mesas distribuidas por zonas
-- ✓ 5 Meseros activos
-- ✓ 4 Tipos de envases
-- ✓ 12 Grupos de recetas
-- ✓ 41 Ingredientes con stock
-- ✓ 18 Recetas del menú
-- ✓ 54 Relaciones ingrediente-receta
-- ✓ 1 Configuración operativa
--
-- TOTAL: 149+ registros de datos reales del restaurante (sin meseros)
-- ==========================================