ALTER TABLE "OrderCombinationOption"
ADD COLUMN "optionGroupNameSnapshot" TEXT NOT NULL DEFAULT '';

ALTER TABLE "OrderCombinationOption"
ALTER COLUMN "optionGroupNameSnapshot" DROP DEFAULT;

CREATE TABLE "OrderEvent" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "actorId" UUID,
    "type" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus",
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderEvent_orderId_createdAt_idx"
ON "OrderEvent"("orderId", "createdAt");

ALTER TABLE "OrderEvent"
ADD CONSTRAINT "OrderEvent_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
