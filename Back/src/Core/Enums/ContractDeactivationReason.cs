namespace Core.Enums;

public enum ContractDeactivationReason
{
    CustomerCancelled = 0,        // Buyurtmachi bekor qildi
    PaymentIssue = 1,             // To'lov muammosi
    TechnicalInfeasibility = 2,   // Texnik jihatdan amalga oshirib bo'lmaydi
    MaterialUnavailable = 3,      // Material yoki resurs yetishmasligi
    DeadlineExpired = 4,          // Muddati o'tib ketdi
    Other = 5,                    // Boshqa (foydalanuvchi qo'lda kiritadi)
}
