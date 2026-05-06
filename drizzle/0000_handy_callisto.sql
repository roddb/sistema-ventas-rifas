CREATE TABLE `combo_purchase_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`combo_purchase_id` text NOT NULL,
	`combo_id` text NOT NULL,
	`combo_name_snapshot` text NOT NULL,
	`unit_price` real NOT NULL,
	`quantity` integer NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`combo_purchase_id`) REFERENCES `combo_purchases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `combo_purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text,
	`buyer_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`total_amount` real NOT NULL,
	`items_count` integer NOT NULL,
	`mercado_pago_preference_id` text,
	`mercado_pago_payment_id` text,
	`payment_status` text DEFAULT 'pending',
	`payment_method` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `event_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_type` text NOT NULL,
	`purchase_id` text,
	`order_id` text,
	`data` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`buyer_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`student_name` text,
	`division` text,
	`course` text,
	`total_amount` real NOT NULL,
	`has_raffle` integer NOT NULL,
	`has_combos` integer NOT NULL,
	`mercado_pago_preference_id` text,
	`mercado_pago_payment_id` text,
	`payment_status` text DEFAULT 'pending',
	`payment_method` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `purchase_numbers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`purchase_id` text NOT NULL,
	`raffle_number_id` integer NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`raffle_number_id`) REFERENCES `raffle_numbers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`raffle_id` integer NOT NULL,
	`order_id` text,
	`buyer_name` text NOT NULL,
	`student_name` text NOT NULL,
	`division` text NOT NULL,
	`course` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`total_amount` real NOT NULL,
	`numbers_count` integer NOT NULL,
	`mercado_pago_preference_id` text,
	`mercado_pago_payment_id` text,
	`payment_status` text DEFAULT 'pending',
	`payment_method` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`raffle_id`) REFERENCES `raffles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `raffle_numbers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`raffle_id` integer NOT NULL,
	`number` integer NOT NULL,
	`status` text DEFAULT 'available',
	`reserved_at` integer,
	`sold_at` integer,
	`purchase_id` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`raffle_id`) REFERENCES `raffles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `raffles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`total_numbers` integer DEFAULT 1500 NOT NULL,
	`price_per_number` real NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP
);
