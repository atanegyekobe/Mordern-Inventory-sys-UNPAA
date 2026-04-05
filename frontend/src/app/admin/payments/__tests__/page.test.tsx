/// <reference types="jest" />

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminPaymentsPage from "../page";
import api from "@/lib/api";

jest.mock("@/lib/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock("@/components/AdminShell", () => ({
  __esModule: true,
  default: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

jest.mock("@/hooks/useToast", () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("Admin payments dashboard", () => {
  const mockedApi = api as jest.Mocked<typeof api>;

  const orders = [
    {
      id: "order-1",
      status: "pending_payment",
      total: 120,
      currency: "GHS",
      createdAt: "2026-03-15T09:00:00.000Z",
      metadata: {
        payment: {
          provider: "paystack",
          status: "pending",
          reference: "ref-123",
        },
      },
      User: {
        id: "user-1",
        name: "Customer One",
        email: "customer@example.com",
      },
    },
    {
      id: "order-2",
      status: "processing",
      total: 400,
      currency: "GHS",
      createdAt: "2026-03-15T10:00:00.000Z",
      metadata: {
        payment: {
          provider: "offline",
          status: "success",
          reference: "offline-ref-456",
          refundedAmount: 0,
        },
      },
      User: {
        id: "user-2",
        name: "Customer Two",
        email: "customer2@example.com",
      },
    },
    {
      id: "order-3",
      status: "pending_payment",
      total: 250,
      currency: "GHS",
      createdAt: "2026-03-15T11:00:00.000Z",
      metadata: {
        payment: {
          provider: "offline",
          status: "pending",
          reference: "offline-ref-789",
          pendingOfflineOverride: {
            reasonCode: "offline_bank_transfer",
            approvalReference: "APR-789456",
            amount: 250,
            requestedBy: "admin-1",
            requestedAt: "2026-03-15T11:10:00.000Z",
            internalNote: "Awaiting maker-checker approval.",
          },
        },
      },
      User: {
        id: "user-3",
        name: "Customer Three",
        email: "customer3@example.com",
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.get.mockResolvedValue({ data: { orders } } as never);
  });

  it("loads orders and shows payment KPI cards", async () => {
    render(<AdminPaymentsPage />);

    await waitFor(() => {
      expect(screen.getByText("Payments")).toBeInTheDocument();
      expect(screen.getByText("3 payment records")).toBeInTheDocument();
    });

    expect(screen.getByText("Settled Payments")).toBeInTheDocument();
    expect(screen.getByText("Pending Attention")).toBeInTheDocument();
    expect(screen.getByText("Refunded Orders")).toBeInTheDocument();
    expect(screen.getByText("Offline Overrides")).toBeInTheDocument();
    expect(mockedApi.get).toHaveBeenCalledWith("/orders");
  });

  it("submits payment recheck from payments dashboard", async () => {
    mockedApi.post.mockResolvedValue({
      data: { verified: true, alreadyPaid: false },
    } as never);

    render(<AdminPaymentsPage />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Recheck" }).length).toBeGreaterThan(0);
    });

    await userEvent.click(screen.getAllByRole("button", { name: "Recheck" })[0]);
    await userEvent.type(
      screen.getByPlaceholderText(/Required internal note for audit trail/i),
      "Valid internal note for payment recheck"
    );
    await userEvent.click(screen.getByRole("button", { name: "Run Payment Recheck" }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/orders/order-3/recheck-payment", {
        internalNote: "Valid internal note for payment recheck",
      });
    });
  });

  it("submits partial refund action", async () => {
    mockedApi.post.mockResolvedValue({ data: { message: "Partial refund processed." } } as never);

    render(<AdminPaymentsPage />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Refund" }).length).toBeGreaterThan(0);
    });

    const refundButtons = screen.getAllByRole("button", { name: "Refund" });
    const enabledRefundButton = refundButtons.find((button) => !button.hasAttribute("disabled"));
    expect(enabledRefundButton).toBeDefined();
    await userEvent.click(enabledRefundButton as HTMLElement);

    await userEvent.type(screen.getByPlaceholderText(/Enter partial refund amount/i), "120");
    await userEvent.selectOptions(screen.getByLabelText(/Refund Reason Code/i), "customer_request");
    await userEvent.type(
      screen.getByPlaceholderText(/Required internal note for audit trail/i),
      "Valid internal note for refund action"
    );
    await userEvent.click(screen.getByRole("button", { name: "Apply Refund" }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/orders/order-2/refunds", {
        refundType: "partial",
        amount: 120,
        reasonCode: "customer_request",
        reasonNote: null,
        internalNote: "Valid internal note for refund action",
      });
    });
  });

  it("submits offline payment override action", async () => {
    mockedApi.post.mockResolvedValue({
      data: { message: "Offline payment override request submitted for second approval." },
    } as never);

    render(<AdminPaymentsPage />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Override" }).length).toBeGreaterThan(0);
    });

    const overrideButtons = screen.getAllByRole("button", { name: "Override" });
    await userEvent.click(overrideButtons[0]);

    await userEvent.selectOptions(
      screen.getByLabelText(/Override Reason Code/i),
      "offline_bank_transfer"
    );
    await userEvent.type(screen.getByPlaceholderText(/Approved settlement reference/i), "APR-222333");
    await userEvent.type(
      screen.getByPlaceholderText(/Required internal note for audit trail/i),
      "Valid internal note for offline override"
    );
    await userEvent.click(screen.getByRole("button", { name: "Apply Override" }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/orders/order-2/payment-override", {
        reasonCode: "offline_bank_transfer",
        approvalReference: "APR-222333",
        internalNote: "Valid internal note for offline override",
      });
    });
  });

  it("approves pending offline payment override action", async () => {
    mockedApi.post.mockResolvedValue({
      data: { message: "Offline payment settlement approved and recorded." },
    } as never);

    render(<AdminPaymentsPage />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Approve" }).length).toBeGreaterThan(0);
    });

    await userEvent.click(screen.getAllByRole("button", { name: "Approve" })[0]);
    await userEvent.type(
      screen.getByPlaceholderText(/Required internal note for approval/i),
      "Second approver validated evidence and approved settlement"
    );
    await userEvent.click(screen.getByRole("button", { name: "Approve Override" }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/orders/order-3/payment-override/approve", {
        internalNote: "Second approver validated evidence and approved settlement",
      });
    });
  });
});
