import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Esquema inicial de Fluxa. Generado con `migration:generate` y ajustado a
 * mano: el enum `category_type` lo comparten `categories` y `transactions`,
 * y el generador lo crea (y lo borra) dos veces, lo que hace fallar la
 * migración. Aquí se crea una sola vez y se elimina al final del `down`.
 */
export class InitialSchema1795039070314 implements MigrationInterface {
  name = 'InitialSchema1795039070314';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "email" character varying(255) NOT NULL, "password_hash" character varying(255) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."category_type" AS ENUM('income', 'expense')`,
    );
    await queryRunner.query(
      `CREATE TABLE "categories" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "type" "public"."category_type" NOT NULL, "user_id" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_categories_user_type_name" UNIQUE ("user_id", "type", "name"), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "transactions" ("id" SERIAL NOT NULL, "amount" numeric(12,2) NOT NULL, "type" "public"."category_type" NOT NULL, "description" character varying(255), "date" date NOT NULL, "category_id" integer NOT NULL, "user_id" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_category" ON "transactions" ("category_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_user_date" ON "transactions" ("user_id", "date") `,
    );
    await queryRunner.query(
      `CREATE TABLE "savings_goals" ("id" SERIAL NOT NULL, "name" character varying(150) NOT NULL, "target_amount" numeric(12,2) NOT NULL, "current_amount" numeric(12,2) NOT NULL DEFAULT '0', "target_date" date, "user_id" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_savings_goals_current_amount_non_negative" CHECK ("current_amount" >= 0), CONSTRAINT "PK_4f1e133521cfbf2b4252bd8f09d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_savings_goals_user" ON "savings_goals" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."savings_goal_movement_type" AS ENUM('deposit', 'withdrawal')`,
    );
    await queryRunner.query(
      `CREATE TABLE "savings_goal_movements" ("id" SERIAL NOT NULL, "goal_id" integer NOT NULL, "amount" numeric(12,2) NOT NULL, "type" "public"."savings_goal_movement_type" NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bdd7b191b06af3242c8b0e6d9fd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_savings_goal_movements_goal_created" ON "savings_goal_movements" ("goal_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "budgets" ("id" SERIAL NOT NULL, "category_id" integer NOT NULL, "amount" numeric(12,2) NOT NULL, "month" smallint NOT NULL, "year" integer NOT NULL, "user_id" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_budgets_user_category_month_year" UNIQUE ("user_id", "category_id", "month", "year"), CONSTRAINT "PK_9c8a51748f82387644b773da482" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_2296b7fe012d95646fa41921c8b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_c9e41213ca42d50132ed7ab2b0f" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_e9acc6efa76de013e8c1553ed2b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "savings_goals" ADD CONSTRAINT "FK_acf18d62676b7b640f44cc6eba5" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "savings_goal_movements" ADD CONSTRAINT "FK_1276954257a0a138a6854cc536f" FOREIGN KEY ("goal_id") REFERENCES "savings_goals"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "budgets" ADD CONSTRAINT "FK_4bb589bf6db49e8c1fd6af05f49" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "budgets" ADD CONSTRAINT "FK_5d25d8bbd6c209261dfe04558f1" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "budgets" DROP CONSTRAINT "FK_5d25d8bbd6c209261dfe04558f1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "budgets" DROP CONSTRAINT "FK_4bb589bf6db49e8c1fd6af05f49"`,
    );
    await queryRunner.query(
      `ALTER TABLE "savings_goal_movements" DROP CONSTRAINT "FK_1276954257a0a138a6854cc536f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "savings_goals" DROP CONSTRAINT "FK_acf18d62676b7b640f44cc6eba5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_e9acc6efa76de013e8c1553ed2b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_c9e41213ca42d50132ed7ab2b0f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "FK_2296b7fe012d95646fa41921c8b"`,
    );
    await queryRunner.query(`DROP TABLE "budgets"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_savings_goal_movements_goal_created"`,
    );
    await queryRunner.query(`DROP TABLE "savings_goal_movements"`);
    await queryRunner.query(`DROP TYPE "public"."savings_goal_movement_type"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_savings_goals_user"`);
    await queryRunner.query(`DROP TABLE "savings_goals"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_transactions_user_date"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_transactions_category"`);
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(`DROP TYPE "public"."category_type"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
