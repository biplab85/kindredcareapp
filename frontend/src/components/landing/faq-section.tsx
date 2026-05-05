"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FaqItem {
  question: string;
  answer: string;
}

const faqs: FaqItem[] = [
  {
    question: "How much does KindredCare cost?",
    answer:
      "There are no subscription fees or upfront costs. KindredCare charges a 7.5% platform fee on each completed booking — that's it. If a caregiver's rate is $25/hour, the family pays $26.88 and the caregiver takes home $23.12. This is significantly less than the 10–15% markup traditional agencies charge.",
  },
  {
    question: "How are caregivers verified?",
    answer:
      "Every caregiver goes through a multi-step verification process: government ID check with facial matching (via Veriff), a CPIC criminal record check (via Certn), AML/sanctions screening, and two professional reference checks. Only caregivers who pass all checks receive the 'Basic Verified' badge and can accept bookings.",
  },
  {
    question: "What services are available?",
    answer:
      "KindredCare offers a wide range of non-medical services: companionship and conversation, technology help, errands and grocery shopping, walking companion, gardening assistance, meal preparation, transportation to appointments, and light housekeeping. More specialized care services are coming soon.",
  },
  {
    question: "What happens if something goes wrong during a visit?",
    answer:
      "Safety is built into every visit. Caregivers check in and out with GPS verification, so you always know when they arrive and leave. Both parties can use an emergency button during visits. All communication is logged in-app. If there's a dispute, our team reviews GPS data, messages, and visit logs to resolve it fairly. Families can also open a dispute within 48 hours of any visit.",
  },
  {
    question: "How do caregivers get paid?",
    answer:
      "Payment is automatic and secure. When a visit is completed, the family's payment method is charged, and after a 24-hour hold period (for dispute resolution), the caregiver receives their payout directly to their bank account via Stripe. Annual earnings statements are provided for tax filing.",
  },
  {
    question: "Is KindredCare available in my area?",
    answer:
      "KindredCare is available across Canada. Caregivers list their services on the marketplace and families book locally — pick whichever province you're in.",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-20 sm:py-28" id="faq">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2>Frequently Asked Questions</h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Everything you need to know about KindredCare.
          </p>
        </div>

        <div className="divide-y divide-border rounded-2xl border border-border bg-card ring-1 ring-foreground/[0.03]">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={index}>
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-start justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-muted/40"
                  aria-expanded={isOpen}
                >
                  <span className="text-[0.95rem] font-medium leading-snug text-foreground">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={cn(
                      "mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform duration-200",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-all duration-200 ease-in-out",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="px-6 pb-5 text-sm leading-relaxed text-muted-foreground">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
