CREATE TABLE `categorias` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categorias_nome_unique` ON `categorias` (`nome`);--> statement-breakpoint
CREATE TABLE `fornecedores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL,
	`contato` text
);
--> statement-breakpoint
CREATE TABLE `movimentacoes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`produto_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`quantidade` integer NOT NULL,
	`motivo` text,
	`fornecedor_id` integer,
	`usuario_id` integer NOT NULL,
	`criado_em` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`produto_id`) REFERENCES `produtos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fornecedor_id`) REFERENCES `fornecedores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `movimentacoes_produto_idx` ON `movimentacoes` (`produto_id`);--> statement-breakpoint
CREATE TABLE `produtos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sku` text NOT NULL,
	`nome` text NOT NULL,
	`categoria_id` integer,
	`unidade` text DEFAULT 'un' NOT NULL,
	`preco_custo` integer DEFAULT 0 NOT NULL,
	`preco_venda` integer DEFAULT 0 NOT NULL,
	`estoque_minimo` integer DEFAULT 0 NOT NULL,
	`saldo_atual` integer DEFAULT 0 NOT NULL,
	`ativo` integer DEFAULT true NOT NULL,
	`criado_em` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`categoria_id`) REFERENCES `categorias`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `produtos_sku_unique` ON `produtos` (`sku`);--> statement-breakpoint
CREATE INDEX `produtos_categoria_idx` ON `produtos` (`categoria_id`);--> statement-breakpoint
CREATE TABLE `usuarios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL,
	`email` text NOT NULL,
	`senha_hash` text NOT NULL,
	`papel` text DEFAULT 'operador' NOT NULL,
	`criado_em` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usuarios_email_unique` ON `usuarios` (`email`);