export const TAG_STREAMS = Object.freeze(["garbage", "recycling", "organics"]);

export function normalizeTagSale(input) {
  const stream = String(input?.stream ?? "").trim();
  if (!TAG_STREAMS.includes(stream))
    throw new Error("Select a valid waste stream.");
  const priceCents = Number(input?.priceCents);
  if (
    !Number.isSafeInteger(priceCents) ||
    priceCents < 1 ||
    priceCents > 1000000
  )
    throw new Error("Tag price must be between 1 and 1,000,000 cents.");
  const receipt = String(input?.receiptReference ?? "").trim();
  if (!/^[\w.:/#-]{4,120}$/.test(receipt))
    throw new Error(
      "A verified POS or external receipt reference is required.",
    );
  const saleId = String(input?.saleId ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(saleId))
    throw new Error("Sale retry ID must be a UUID.");
  return { stream, priceCents, receipt, saleId };
}

export function normalizeTagCode(value) {
  const code = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!/^GT-[A-F0-9]{24}$/.test(code)) throw new Error("Invalid tag code.");
  return code;
}
