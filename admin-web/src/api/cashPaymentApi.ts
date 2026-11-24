import axiosClient from './axiosClient';

export const cashPaymentApi = {
  confirm: (paymentId: string) =>
    axiosClient.post(
      `/payments/${encodeURIComponent(paymentId)}/admin-cash-confirm`,
    ) as unknown as Promise<{
      success: boolean;
      bookingId: string;
      paymentId: string;
    }>,
};
