import { useState, useEffect } from "react";
import { DollarSign, MapPin, Calendar, Heart, Check, X, AlertCircle } from "lucide-react";
import { getTicketPlatformFee, TABLE_PLATFORM_FEE } from "@/utils/ticketFeeCalculator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";
import StripePaymentModal from "@/components/shared/StripePaymentModal";
import { detectIsIOS } from "@/hooks/useIsIOS";

export default function ResaleMarketplace() {
  const [listings, setListings] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myListings, setMyListings] = useState([]);
  const [listingPrice, setListingPrice] = useState("");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [availableTickets, setAvailableTickets] = useState([]);
  const [purchasing, setPurchasing] = useState(null);
  const [filter, setFilter] = useState("all");
  const [resaleClientSecret, setResaleClientSecret] = useState(null);
  const [resaleTotal, setResaleTotal] = useState("");
  const [resaleListingId, setResaleListingId] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      const currentUser = await base44.auth.me().catch(() => null);
      setUser(currentUser);

      // Load all active resale listings
      let allListings = await base44.entities.TicketListing.filter(
        { status: "active" },
        "-created_date",
        500
      );
      
      // Filter out expired listings (event has ended)
      const now = new Date();
      allListings = allListings.filter(listing => {
        if (listing.event_end_date) {
          return now <= new Date(listing.event_end_date);
        }
        return true;
      });
      
      setListings(allListings);

      if (currentUser) {
         // Load user's own listings (excluding expired)
         let userListings = await base44.entities.TicketListing.filter(
           { seller_email: currentUser.email, status: "active" },
           "-created_date",
           100
         );
         // Filter out expired
         const now = new Date();
         userListings = userListings.filter(listing => {
           if (listing.event_end_date) {
             return now <= new Date(listing.event_end_date);
           }
           return true;
         });
         setMyListings(userListings);

        // Load user's active tickets and exclude ones already listed for resale
        const [tickets, existingListings] = await Promise.all([
          base44.entities.Ticket.filter(
            { owner_email: currentUser.email, status: "active" },
            "-created_date",
            100
          ),
          base44.entities.TicketListing.filter(
            { seller_email: currentUser.email, status: "active" },
            null,
            100
          ),
        ]);
        const listedTicketIds = new Set(existingListings.map(l => l.ticket_id));
        setAvailableTickets(tickets.filter(t => !listedTicketIds.has(t.id)));
      }

      setLoading(false);
    };

    loadData();
  }, []);

  const createListing = async () => {
    if (!selectedTicket || !listingPrice) {
      toast.error("Select ticket and enter price");
      return;
    }

    const price = parseFloat(listingPrice);
    const originalPrice = selectedTicket.price_paid || 50;
    const maxPrice = originalPrice * 1.5;

    if (price > maxPrice) {
      toast.error(
        `Price exceeds cap of $${maxPrice.toFixed(2)} (150% of original $${originalPrice.toFixed(2)})`
      );
      return;
    }

    if (price < originalPrice) {
      toast.error(`Price must be at least $${originalPrice.toFixed(2)} (original price)`);
      return;
    }

    try {
      const listing = await base44.entities.TicketListing.create({
        ticket_id: selectedTicket.id,
        ticket_code: selectedTicket.ticket_code,
        event_id: selectedTicket.event_id,
        event_title: selectedTicket.event_title,
        event_end_date: selectedTicket.event_end_date || selectedTicket.date,
        seller_email: user.email,
        seller_name: user.full_name || user.email,
        resale_price: price,        // canonical field used by backend
        original_price: originalPrice,
        ticket_type_name: selectedTicket.ticket_type_name,
        organizer_id: selectedTicket.organizer_id || "",
        status: "active",
      });

      setListings(prev => [listing, ...prev]);
      setMyListings(prev => [listing, ...prev]);
      setAvailableTickets(prev => prev.filter(t => t.id !== selectedTicket.id));
      setSelectedTicket(null);
      setListingPrice("");
      toast.success("Ticket listed for resale!");
    } catch (error) {
      toast.error(error.message || "Failed to create listing");
    }
  };

  const handlePurchase = async (listing) => {
    if (!user) {
      base44.auth.redirectToLogin();
      return;
    }

    if (listing.seller_email === user.email) {
      toast.error("Cannot purchase your own listing");
      return;
    }

    // Check if event has ended
    if (listing.event_end_date) {
      const now = new Date();
      if (now > new Date(listing.event_end_date)) {
        toast.error("This event has ended. Resale no longer available.");
        return;
      }
    }

    setPurchasing(listing.id);

    try {
      const res = await base44.functions.invoke("stripeResaleCheckout", {
        ticketListingId: listing.id,
      });
      if (res.data?.clientSecret) {
        setResaleClientSecret(res.data.clientSecret);
        setResaleTotal(parseFloat(res.data.buyerTotal).toFixed(2));
        setResaleListingId(listing.id);
      } else {
        throw new Error("No payment session returned");
      }
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || "Purchase failed");
    }
    setPurchasing(null);
  };

  const handleResaleSuccess = async () => {
    setResaleClientSecret(null);
    setResaleListingId(null);
    toast.success("Purchase successful! Check your tickets.");
    // Remove from listings
    setListings(prev => prev.filter(l => l.id !== resaleListingId));
  };

  const handleUnlist = async (listingId) => {
    try {
      await base44.entities.TicketListing.update(listingId, { status: "cancelled" });
      setListings(prev => prev.filter(l => l.id !== listingId));
      setMyListings(prev => prev.filter(l => l.id !== listingId));
      toast.success("Listing removed");
    } catch (error) {
      toast.error("Failed to remove listing");
    }
  };

  if (detectIsIOS()) return null;
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const userListingIds = new Set(myListings.map(l => l.id));
  const availableListings = listings.filter(l => l.status === "active");

  return (
    <div className="min-h-screen space-y-6 p-4 sm:p-6 max-w-6xl mx-auto">
      <div>
        <h1 className="font-display font-black text-4xl tracking-tight">RESALE MARKETPLACE</h1>
        <p className="text-sm text-muted-foreground mt-1">Buy & sell verified tickets at fair prices</p>
      </div>

      {/* Create Listing Section */}
      {availableTickets.length > 0 && (
        <div className="p-6 rounded-xl bg-card border border-primary/30 space-y-4">
          <h2 className="font-display font-bold text-lg">SELL YOUR TICKET</h2>
          
          <div className="space-y-3">
            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Select Ticket</label>
              <div className="mt-2 grid gap-2">
                {availableTickets.map(ticket => {
                  const originalPrice = ticket.price_paid || 50;
                  const maxPrice = originalPrice * 1.5;
                  return (
                    <button
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        selectedTicket?.id === ticket.id
                          ? "bg-primary/10 border-primary"
                          : "bg-secondary border-border/50 hover:border-primary/40"
                      }`}
                    >
                      <p className="font-bold">{ticket.event_title}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {ticket.ticket_type_name} · Originally ${originalPrice.toFixed(2)} · Max resale: ${maxPrice.toFixed(2)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedTicket && (
              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Resale Price</label>
                <div className="mt-2 flex gap-2">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                    <Input
                      type="number"
                      value={listingPrice}
                      onChange={e => setListingPrice(e.target.value)}
                      placeholder="0.00"
                      min={selectedTicket.price_paid || 50}
                      max={(selectedTicket.price_paid || 50) * 1.5}
                      step="0.01"
                      className="pl-7 bg-secondary border-border/50"
                    />
                  </div>
                  <Button onClick={createListing} className="glow-lime font-display font-bold">
                    List Ticket
                  </Button>
                </div>
                {listingPrice && !isNaN(parseFloat(listingPrice)) && (
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    You receive: ${parseFloat(listingPrice).toFixed(2)} · Buyer pays: ${(parseFloat(listingPrice) + getTicketPlatformFee(parseFloat(listingPrice))).toFixed(2)} (incl. ${getTicketPlatformFee(parseFloat(listingPrice)).toFixed(2)} platform fee)
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* My Listings */}
      {myListings.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display font-bold text-lg">MY LISTINGS ({myListings.length})</h2>
          <div className="grid gap-3">
            {myListings.map(listing => (
              <div key={listing.id} className="p-4 rounded-lg bg-card border border-accent/40 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold">{listing.event_title}</p>
                    <p className="text-xs text-muted-foreground font-mono">{listing.ticket_type_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display font-bold text-lg text-accent">${(listing.resale_price || listing.listing_price || 0).toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">You receive: ${(listing.resale_price || listing.listing_price || 0).toFixed(2)}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUnlist(listing.id)}
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  <X className="w-3.5 h-3.5 mr-1" /> Remove Listing
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Listings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg">AVAILABLE TICKETS ({availableListings.length})</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`text-xs font-mono font-bold px-3 py-1.5 rounded ${
                filter === "all" ? "bg-primary text-primary-foreground" : "bg-card border border-border/50"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("cheaper")}
              className={`text-xs font-mono font-bold px-3 py-1.5 rounded ${
                filter === "cheaper" ? "bg-primary text-primary-foreground" : "bg-card border border-border/50"
              }`}
            >
              Cheapest First
            </button>
          </div>
        </div>

        {availableListings.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No tickets available for resale</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {(filter === "cheaper"
              ? [...availableListings].sort((a, b) => (a.resale_price || a.listing_price || 0) - (b.resale_price || b.listing_price || 0))
              : availableListings
            ).map(listing => {
              const price = listing.resale_price || listing.listing_price || 0;
              const savings = (listing.original_price || 0) - price;
              const isMine = userListingIds.has(listing.id);

              return (
                <div
                  key={listing.id}
                  className={`p-4 rounded-lg border transition-all ${
                    isMine ? "bg-muted/50 border-muted/50" : "bg-card border-border/50 hover:border-primary/40"
                  } space-y-3`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-display font-bold text-lg">{listing.event_title}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-1">{listing.ticket_type_name}</p>

                      <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground font-mono">
                        {(listing.original_price || 0) > 0 && <span className="flex items-center gap-1">
                         <DollarSign className="w-3 h-3" />
                         Original: ${listing.original_price.toFixed(2)}
                        </span>}
                        {savings < 0 && (
                          <span className="flex items-center gap-1 text-yellow-400">
                            <AlertCircle className="w-3 h-3" />
                            {Math.abs(savings).toFixed(2)} markup
                          </span>
                        )}
                        {savings > 0 && (
                          <span className="flex items-center gap-1 text-green-400">
                            <Check className="w-3 h-3" />
                            Save ${savings.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-display font-bold text-2xl text-primary">${(listing.resale_price || listing.listing_price || 0).toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {isMine ? "Your listing" : `+$${getTicketPlatformFee(listing.resale_price || listing.listing_price || 0).toFixed(2)} platform fee`}
                      </p>
                    </div>
                  </div>

                  {!isMine && (() => {
                    const lPrice = listing.resale_price || listing.listing_price || 0;
                    const fee = getTicketPlatformFee(lPrice);
                    const buyerTotal = lPrice + fee;
                    return (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-mono text-muted-foreground">
                          <span>Ticket price</span><span>${lPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs font-mono text-muted-foreground">
                          <span>Platform fee</span><span>${fee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold border-t border-border/40 pt-1">
                          <span>Total</span><span className="text-primary">${buyerTotal.toFixed(2)}</span>
                        </div>
                        <Button
                          onClick={() => handlePurchase(listing)}
                          disabled={purchasing === listing.id}
                          className="w-full glow-lime font-display font-bold gap-1.5"
                        >
                          <Heart className="w-4 h-4" />
                          {purchasing === listing.id ? "Processing..." : `Buy Now · $${buyerTotal.toFixed(2)}`}
                        </Button>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {resaleClientSecret && (
        <StripePaymentModal
          clientSecret={resaleClientSecret}
          amount={resaleTotal}
          label="Resale Ticket Purchase"
          onSuccess={handleResaleSuccess}
          onClose={() => { setResaleClientSecret(null); setResaleListingId(null); }}
        />
      )}

      {/* Info Box */}
      <div className="p-4 rounded-lg bg-primary/10 border border-primary/30 space-y-2 text-sm">
        <p className="font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> Resale Rules
        </p>
        <ul className="text-xs text-muted-foreground space-y-1 font-mono">
          <li>• Price cap: 150% of original ticket price</li>
          <li>• Platform fee: $1–$5 per ticket (paid by buyer, based on ticket price)</li>
          <li>• Ownership transfers automatically upon purchase</li>
          <li>• All transactions verified and secure</li>
        </ul>
      </div>
    </div>
  );
}