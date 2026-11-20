ALTER TABLE `usuarios` ADD `ativo` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `usuarios` ADD `convite_hash` text;--> statement-breakpoint
ALTER TABLE `usuarios` ADD `convite_expira_em` text;--> statement-breakpoint
ALTER TABLE `usuarios` ADD `sessao_versao` integer DEFAULT 0 NOT NULL;