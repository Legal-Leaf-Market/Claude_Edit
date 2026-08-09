CREATE TABLE "flip_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" text NOT NULL,
	"kind" varchar(20) DEFAULT 'flip' NOT NULL,
	"title" varchar(200) NOT NULL,
	"category" varchar(50) DEFAULT 'other' NOT NULL,
	"description" text NOT NULL,
	"asking_price_cents" integer,
	"location" varchar(200),
	"image_url" text,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flip_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "flip_threads" ADD CONSTRAINT "flip_threads_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "flip_replies" ADD CONSTRAINT "flip_replies_thread_id_flip_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."flip_threads"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "flip_replies" ADD CONSTRAINT "flip_replies_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_flip_threads_kind_status_created" ON "flip_threads" USING btree ("kind","status","created_at");
--> statement-breakpoint
CREATE INDEX "idx_flip_threads_author" ON "flip_threads" USING btree ("author_id");
--> statement-breakpoint
CREATE INDEX "idx_flip_replies_thread" ON "flip_replies" USING btree ("thread_id","created_at");
