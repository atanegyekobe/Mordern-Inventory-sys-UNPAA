import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminOrdersPage from "../page";
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

describe("Admin orders dashboard UI", () => {
  const mockedApi = api as jest.Mocked<typeof api>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders KPI cards from /orders/dashboard and fetches both endpoints", async () => {
    const orders = [
      {
        id: "fraud1111-0000-0000-0000-000000000000",
        status: "fraud_hold",
        total: 150000,
        currency: "GHS",
        createdAt: "2026-03-15T09:00:00.000Z",
        metadata: { fraudReview: { underReview: true, signals: [] } },
      },
      {
        id: "paid2222-0000-0000-0000-000000000000",
        status: "paid",
        total: 500,
        currency: "GHS",
        createdAt: "2026-03-15T10:00:00.000Z",
        metadata: {},
      },
    ];

    const dashboard = {
      kpis: {
        totalOrdersToday: 12,
        pendingFulfillment: 34,
        delayedShipments: 6,
        highValueOrders: 4,
        riskFlaggedOrders: 3,
        refundsAwaitingApproval: 2,
      },
      statusCounts: {
        pending_payment: 1,
        fraud_hold: 1,
        pending: 0,
        paid: 1,
        processing: 0,
        packed: 0,
        shipped: 0,
        out_for_delivery: 0,
        delivered: 0,
        received: 0,
        delivery_failed: 0,
        delivery_pickup: 0,
        fulfilled: 0,
        cancelled: 0,
        returned: 0,
        refunded: 0,
      },
      thresholds: {
        highValueThreshold: 100000,
        delayedShipmentDays: 5,
        pendingRiskHours: 24,
        refundWindowDays: 14,
      },
    };

    mockedApi.get.mockImplementation(async (url: string) => {
      if (url === "/orders") {
        return { data: { orders } } as never;
      }
      if (url === "/orders/dashboard") {
        return { data: dashboard } as never;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    render(<AdminOrdersPage />);

    await waitFor(() => {
      expect(screen.getByText("12")).toBeInTheDocument();
    });

    expect(screen.getByText("34")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    expect(mockedApi.get).toHaveBeenCalledWith("/orders");
    expect(mockedApi.get).toHaveBeenCalledWith("/orders/dashboard");
  });

  it("filters list when Needs Action is enabled", async () => {
    const orders = [
      {
        id: "fraud1111-0000-0000-0000-000000000000",
        status: "fraud_hold",
        total: 150000,
        currency: "GHS",
        createdAt: "2026-03-15T09:00:00.000Z",
        metadata: { fraudReview: { underReview: true, signals: [] } },
      },
      {
        id: "paid2222-0000-0000-0000-000000000000",
        status: "paid",
        total: 500,
        currency: "GHS",
        createdAt: "2026-03-15T10:00:00.000Z",
        metadata: {},
      },
    ];

    const dashboard = {
      kpis: {
        totalOrdersToday: 2,
        pendingFulfillment: 1,
        delayedShipments: 0,
        highValueOrders: 1,
        riskFlaggedOrders: 1,
        refundsAwaitingApproval: 0,
      },
      statusCounts: {
        pending_payment: 0,
        fraud_hold: 1,
        pending: 0,
        paid: 1,
        processing: 0,
        packed: 0,
        shipped: 0,
        out_for_delivery: 0,
        delivered: 0,
        received: 0,
        delivery_failed: 0,
        delivery_pickup: 0,
        fulfilled: 0,
        cancelled: 0,
        returned: 0,
        refunded: 0,
      },
      thresholds: {
        highValueThreshold: 100000,
        delayedShipmentDays: 5,
        pendingRiskHours: 24,
        refundWindowDays: 14,
      },
    };

    mockedApi.get.mockImplementation(async (url: string) => {
      if (url === "/orders") {
        return { data: { orders } } as never;
      }
      if (url === "/orders/dashboard") {
        return { data: dashboard } as never;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    render(<AdminOrdersPage />);

    await waitFor(() => {
      expect(screen.getByText("Showing 1-2 of 2")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /Filters and views/i }));

    await userEvent.click(screen.getByRole("button", { name: "Needs Action" }));

    await waitFor(() => {
      expect(screen.getAllByText("Showing 1-1 of 1").length).toBeGreaterThan(0);
    });
  });

  it("renders grouped alert panel and allows collapsing/expanding a group", async () => {
    const orders = [
      {
        id: "fraud1111-0000-0000-0000-000000000000",
        status: "fraud_hold",
        total: 150000,
        currency: "GHS",
        createdAt: "2026-03-15T09:00:00.000Z",
        metadata: { fraudReview: { underReview: true, signals: [] } },
      },
      {
        id: "ship3333-0000-0000-0000-000000000000",
        status: "shipped",
        total: 1200,
        currency: "GHS",
        createdAt: "2026-03-01T10:00:00.000Z",
        metadata: {},
      },
    ];

    const dashboard = {
      kpis: {
        totalOrdersToday: 2,
        pendingFulfillment: 1,
        delayedShipments: 1,
        highValueOrders: 1,
        riskFlaggedOrders: 1,
        refundsAwaitingApproval: 0,
      },
      statusCounts: {
        pending_payment: 0,
        fraud_hold: 1,
        pending: 0,
        paid: 0,
        processing: 0,
        packed: 0,
        shipped: 1,
        out_for_delivery: 0,
        delivered: 0,
        received: 0,
        delivery_failed: 0,
        delivery_pickup: 0,
        fulfilled: 0,
        cancelled: 0,
        returned: 0,
        refunded: 0,
      },
      thresholds: {
        highValueThreshold: 100000,
        delayedShipmentDays: 5,
        pendingRiskHours: 24,
        refundWindowDays: 14,
      },
    };

    mockedApi.get.mockImplementation(async (url: string) => {
      if (url === "/orders") {
        return { data: { orders } } as never;
      }
      if (url === "/orders/dashboard") {
        return { data: dashboard } as never;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    render(<AdminOrdersPage />);

    await waitFor(() => {
      expect(screen.getByText("2 active alerts")).toBeInTheDocument();
    });

    const fraudGroupToggle = screen.getByRole("button", { name: /Fraud \/ Review Alerts/i });
    const fraudGroupCard = fraudGroupToggle.parentElement;
    expect(fraudGroupCard).not.toBeNull();

    const groupWithin = within(fraudGroupCard as HTMLElement);
    await userEvent.click(fraudGroupToggle);

    await waitFor(() => {
      expect(groupWithin.getByText(/Order fraud111/i)).toBeInTheDocument();
    });

    await userEvent.click(fraudGroupToggle);

    await waitFor(() => {
      expect(groupWithin.queryByText(/Order fraud111/i)).not.toBeInTheDocument();
    });

    await userEvent.click(fraudGroupToggle);

    await waitFor(() => {
      expect(groupWithin.getByText(/Order fraud111/i)).toBeInTheDocument();
    });
  });
});
