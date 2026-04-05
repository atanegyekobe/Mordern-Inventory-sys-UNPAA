import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminOrderDetailPage from "../page";
import api from "@/lib/api";

jest.mock("@/lib/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "order-1" }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
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

describe("Admin order detail manual action flows", () => {
  const mockedApi = api as jest.Mocked<typeof api>;

  const createBaseOrder = (overrides: Record<string, unknown> = {}) => ({
    id: "order-1",
    status: "paid",
    total: 1500,
    currency: "GHS",
    createdAt: "2026-03-15T09:00:00.000Z",
    metadata: {
      payment: {
        provider: "paystack",
        status: "pending",
        reference: "ref-123",
      },
      automationOverride: {
        preventAutoTransition: false,
      },
      fraudReview: {
        underReview: false,
        signals: [],
      },
    },
    User: {
      id: "user-1",
      name: "Customer One",
      email: "customer@example.com",
      phone: "0000000",
    },
    UserId: "user-1",
    OrderItems: [
      {
        id: "item-1",
        quantity: 1,
        unitPrice: 1500,
        Product: {
          name: "Test Product",
        },
      },
    ],
    OrderStatusEvents: [],
    ...overrides,
  });

  const mockOrderDetailLoad = (order: Record<string, unknown>) => {
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url === "/orders/order-1") {
        return { data: { order } } as never;
      }

      throw new Error(`Unexpected GET ${url}`);
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("submits disable automation from detail page with reason and internal note", async () => {
    const order = createBaseOrder();
    mockOrderDetailLoad(order);
    mockedApi.patch.mockResolvedValue({ data: {} } as never);

    render(<AdminOrderDetailPage />);
    const internalNoteInput = (await screen.findAllByLabelText(/Internal Note/i))[0];

    await userEvent.type(
      internalNoteInput,
      "Valid internal note for automation action"
    );
    await userEvent.type(
      screen.getByPlaceholderText(/Explain why automation should be disabled/i),
      "Temporarily disable automation for manual fulfillment review"
    );

    await userEvent.click(screen.getByRole("button", { name: "Disable Automation" }));

    await waitFor(() => {
      expect(mockedApi.patch).toHaveBeenCalledWith(
        "/orders/order-1/automation-override",
        expect.objectContaining({
          preventAutoTransition: true,
          reason: "Temporarily disable automation for manual fulfillment review",
          category: "fulfillment_issue",
          internalNote: "Valid internal note for automation action",
          effectiveUntil: null,
        })
      );
    });
  });

  it("submits fraud release action with reason, note, and selected release status", async () => {
    const order = createBaseOrder({
      status: "fraud_hold",
      metadata: {
        payment: {
          provider: "paystack",
          status: "pending",
          reference: "ref-123",
        },
        automationOverride: {
          preventAutoTransition: false,
        },
        fraudReview: {
          underReview: true,
          signals: [{ code: "flag", label: "Flagged signal" }],
        },
      },
    });

    mockOrderDetailLoad(order);
    mockedApi.patch.mockResolvedValue({ data: { message: "Fraud review action applied." } } as never);

    render(<AdminOrderDetailPage />);
    const internalNoteInput = (await screen.findAllByLabelText(/Internal Note/i))[0];

    await userEvent.type(
      internalNoteInput,
      "Internal note for fraud release"
    );
    await userEvent.type(
      screen.getByPlaceholderText(/Reason for hold, release, or mark reviewed/i),
      "Fraud checks completed and the order is approved for release"
    );
    await userEvent.selectOptions(screen.getByLabelText(/Release To Status/i), "cancelled");
    await userEvent.click(screen.getByRole("button", { name: "Release" }));

    await waitFor(() => {
      expect(mockedApi.patch).toHaveBeenCalledWith(
        "/orders/order-1/fraud-review",
        expect.objectContaining({
          action: "release",
          reason: "Fraud checks completed and the order is approved for release",
          internalNote: "Internal note for fraud release",
          releaseStatus: "cancelled",
        })
      );
    });
  });

  it("shows compact payment summary and links to payments workspace", async () => {
    const order = createBaseOrder({
      status: "processing",
      metadata: {
        payment: {
          provider: "paystack",
          status: "success",
          reference: "ref-123",
        },
      },
    });

    mockOrderDetailLoad(order);

    render(<AdminOrderDetailPage />);

    expect(await screen.findByText("Payment Summary")).toBeInTheDocument();

    const openInPaymentsLink = screen.getByRole("link", { name: "Open in Payments" });
    expect(openInPaymentsLink).toHaveAttribute("href", "/admin/payments?orderId=order-1");
    expect(screen.queryByRole("button", { name: "Recheck Payment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply Refund" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply Adjustment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply Payment Override" })).not.toBeInTheDocument();
  });

  it("renders key detail UI sections and customer links", async () => {
    const order = createBaseOrder({
      status: "processing",
      shippingAddress: "123 Main Street",
      billingAddress: "456 Billing Ave",
      OrderStatusEvents: [
        {
          id: "evt-1",
          toStatus: "processing",
          fromStatus: "paid",
          createdAt: "2026-03-15T10:00:00.000Z",
          actorRole: "admin",
          note: "Packed for dispatch",
        },
      ],
    });

    mockOrderDetailLoad(order);

    render(<AdminOrderDetailPage />);

    expect(await screen.findByText("Payment Summary")).toBeInTheDocument();
    expect(screen.getByText("Automation Override")).toBeInTheDocument();
    expect(screen.getByText("Fraud Review", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Operational Data")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show Shipping Fields" })).toBeInTheDocument();

    const customerProfileLink = screen.getByRole("link", { name: "View Customer Profile" });
    expect(customerProfileLink).toHaveAttribute("href", "/admin/customers/user-1");
  });

  it(
    "submits enable automation action with internal note when override is active",
    async () => {
    const order = createBaseOrder({
      status: "processing",
      metadata: {
        payment: {
          provider: "paystack",
          status: "pending",
          reference: "ref-123",
        },
        automationOverride: {
          preventAutoTransition: true,
        },
        fraudReview: {
          underReview: false,
          signals: [],
        },
      },
    });

    mockOrderDetailLoad(order);
    mockedApi.patch.mockResolvedValue({ data: {} } as never);

    render(<AdminOrderDetailPage />);

    const internalNoteInput = (await screen.findAllByLabelText(/Internal Note/i))[0];
    await userEvent.type(internalNoteInput, "Enable automation after manual checks complete");
    await userEvent.click(screen.getByRole("button", { name: "Enable Automation" }));

      await waitFor(() => {
        expect(mockedApi.patch).toHaveBeenCalledWith(
          "/orders/order-1/automation-override",
          expect.objectContaining({
            preventAutoTransition: false,
            reason: null,
            category: null,
            internalNote: "Enable automation after manual checks complete",
            effectiveUntil: null,
          })
        );
      });
    },
    15000
  );

  it("auto-expands and locks shipping fields when order is already shipped", async () => {
    const order = createBaseOrder({
      status: "shipped",
      shippingAddress: "Shipped address",
      billingAddress: "Billing address",
      metadata: {
        payment: {
          provider: "paystack",
          status: "success",
          reference: "ref-123",
        },
        automationOverride: {
          preventAutoTransition: false,
        },
        fraudReview: {
          underReview: false,
          signals: [],
        },
        operational: {
          shippingData: {
            carrier: "DHL",
            trackingNumber: "TRK-123",
            shipDate: null,
            deliveryEta: null,
          },
          contact: {
            phone: "+233500000001",
            deliveryInstructions: "Call on arrival",
          },
          assignment: {
            owner: "ops.lead",
            priority: "high",
            escalationFlag: true,
          },
        },
      },
    });

    mockOrderDetailLoad(order);

    render(<AdminOrderDetailPage />);

    expect(await screen.findByRole("button", { name: "Hide Shipping Fields" })).toBeInTheDocument();
    expect(screen.getByText(/Shipping and billing addresses are locked after shipped state/i)).toBeInTheDocument();

    const shippingAddressField = screen.getByLabelText(/Shipping Address/i);
    const billingAddressField = screen.getByLabelText(/Billing Address/i);

    expect(shippingAddressField).toBeDisabled();
    expect(billingAddressField).toBeDisabled();
  });

  it("allows manually toggling shipping fields for non-shipped orders", async () => {
    const order = createBaseOrder({
      status: "processing",
      shippingAddress: "Old shipping address",
      billingAddress: "Old billing address",
    });

    mockOrderDetailLoad(order);

    render(<AdminOrderDetailPage />);

    expect(await screen.findByRole("button", { name: "Show Shipping Fields" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Shipping Address/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Show Shipping Fields" }));
    expect(await screen.findByRole("button", { name: "Hide Shipping Fields" })).toBeInTheDocument();
    expect(await screen.findByLabelText(/Shipping Address/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Hide Shipping Fields" }));
    expect(screen.getByRole("button", { name: "Show Shipping Fields" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Shipping Address/i)).not.toBeInTheDocument();
  });

  it(
    "submits operational data update including assignment and address correction reason",
    async () => {
    const order = createBaseOrder({
      status: "processing",
      shippingAddress: "Old shipping address",
      billingAddress: "Old billing address",
      metadata: {
        payment: {
          provider: "paystack",
          status: "pending",
          reference: "ref-123",
        },
        operational: {
          shippingData: {
            carrier: "",
            trackingNumber: "",
            shipDate: null,
            deliveryEta: null,
          },
          contact: {
            phone: "",
            deliveryInstructions: "",
          },
          assignment: {
            owner: null,
            priority: "normal",
            escalationFlag: false,
          },
        },
      },
    });

    mockOrderDetailLoad(order);
    mockedApi.patch.mockResolvedValue({ data: { message: "Operational order data updated." } } as never);

    render(<AdminOrderDetailPage />);
    const internalNoteInput = (await screen.findAllByLabelText(/Internal Note/i))[0];

    await userEvent.type(
      internalNoteInput,
      "Internal note for operational correction"
    );

    await userEvent.click(screen.getByRole("button", { name: "Show Shipping Fields" }));

    await userEvent.type(screen.getByPlaceholderText(/e\.g\. DHL/i), "DHL");
    await userEvent.type(screen.getByPlaceholderText(/Shipment tracking reference/i), "TRK-ABC-123");
    await userEvent.type(screen.getByPlaceholderText(/Corrected contact phone/i), "+233500000000");
    await userEvent.type(screen.getByPlaceholderText(/ops\.agent or team owner/i), "ops.lead");
    await userEvent.selectOptions(screen.getByLabelText(/Assignment Priority/i), "high");
    await userEvent.click(screen.getByLabelText(/Escalation Flag/i));

    const shippingAddressInput = screen.getByLabelText(/Shipping Address/i);
    await userEvent.clear(shippingAddressInput);
    await userEvent.type(shippingAddressInput, "New shipping address line 1");

    await userEvent.type(
      screen.getByPlaceholderText(/State why the address correction is needed/i),
      "Customer called and confirmed corrected destination details"
    );

    await userEvent.click(screen.getByRole("button", { name: "Save Operational Data" }));

    await waitFor(() => {
      expect(mockedApi.patch).toHaveBeenCalledWith(
        "/orders/order-1/operational-data",
        expect.objectContaining({
          carrier: "DHL",
          trackingNumber: "TRK-ABC-123",
          customerPhone: "+233500000000",
          assignmentOwner: "ops.lead",
          assignmentPriority: "high",
          escalationFlag: true,
          shippingAddress: "New shipping address line 1",
          addressCorrectionReason: "Customer called and confirmed corrected destination details",
          internalNote: "Internal note for operational correction",
        })
      );
    });
    },
    15000
  );
});