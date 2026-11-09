"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { Check, CircleAlert, Info, Loader2, MoreHorizontal, Plus, Upload } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Toaster } from "@/components/ui/sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type DemoForm = { headline: string };

export default function UiGallery() {
  const form = useForm<DemoForm>({ defaultValues: { headline: "Solar sale" } });
  const [loading, setLoading] = React.useState(false);

  function showLoading() {
    setLoading(true);
    window.setTimeout(() => setLoading(false), 900);
  }

  return (
    <TooltipProvider>
      <main className="min-h-dvh bg-surface p-4 text-foreground sm:p-8">
        <Toaster />
        <div className="mx-auto max-w-5xl">
          <p className="text-callout text-brand-text">SharpFlyer development tools</p>
          <h1 className="mt-3 text-h1">Component states</h1>
          <p className="mt-2 text-body-lg text-muted-foreground">Interactive reference for Phase 0 components.</p>

          <section className="mt-8 flex flex-col gap-6 rounded-2xl bg-background p-5 shadow-2 sm:p-8">
            <h2 className="text-h2">Actions and status</h2>
            <div className="flex flex-wrap items-center gap-3">
              <Button>Default action</Button><Button variant="brand">Brand action</Button><Button variant="secondary">Secondary</Button><Button variant="ghost">Ghost</Button><Button variant="outline">Outline</Button><Button variant="destructive">Delete flyer</Button><Button size="icon" aria-label="Add"><Plus /></Button><Button disabled>Disabled</Button><Button disabled={loading} onClick={showLoading}>{loading && <Loader2 className="animate-spin" />} {loading ? "Loading" : "Try loading"}</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2"><Badge>Neutral</Badge><Badge variant="brand">Brand</Badge><Badge variant="success">Saved</Badge><Badge variant="warning">Low credits</Badge><Badge variant="danger">Error</Badge><Avatar className="size-10"><AvatarFallback>SF</AvatarFallback></Avatar><Skeleton className="h-10 w-32" /></div>
            <div className="flex flex-wrap items-center gap-3"><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label="More"><MoreHorizontal /></Button></TooltipTrigger><TooltipContent>More actions</TooltipContent></Tooltip><Button variant="secondary" onClick={() => toast("Flyer exported")}>Show toast</Button><Progress value={62} className="max-w-xs" /></div>
          </section>

          <section className="mt-6 rounded-2xl bg-background p-5 shadow-2 sm:p-8">
            <h2 className="text-h2">Forms and controls</h2>
            <Form {...form}><form className="mt-6 flex max-w-xl flex-col gap-5" onSubmit={form.handleSubmit(() => toast("Details saved"))}>
              <FormField control={form.control} name="headline" render={({ field }) => <FormItem><FormLabel>Headline</FormLabel><FormControl><Input {...field} /></FormControl><FormDescription>Shows on the flyer exactly as entered.</FormDescription><FormMessage /></FormItem>} />
              <div className="flex flex-col gap-2"><Label htmlFor="body-copy">Offer copy (optional)</Label><Textarea id="body-copy" placeholder="Add a short offer" /></div>
              <div className="flex flex-col gap-2"><Label htmlFor="error-input">Error state</Label><Input id="error-input" aria-invalid="true" className="ring-2 ring-danger-text" defaultValue="Needs attention" /><p className="text-small text-danger-text">Enter a valid value.</p></div>
              <div className="flex flex-wrap items-center gap-6"><label className="flex min-h-11 items-center gap-3 text-callout"><Checkbox defaultChecked /> Use brand logo</label><label className="flex min-h-11 items-center gap-3 text-callout"><Switch defaultChecked /> Dark mode</label></div>
              <RadioGroup defaultValue="status" aria-label="Format" className="flex-row"><label className="flex items-center gap-2"><RadioGroupItem value="status" /> Status</label><label className="flex items-center gap-2"><RadioGroupItem value="post" /> Post</label></RadioGroup>
              <div className="flex flex-wrap gap-3"><Select defaultValue="solar"><SelectTrigger className="max-w-xs"><SelectValue placeholder="Choose a category" /></SelectTrigger><SelectContent><SelectItem value="solar">Solar</SelectItem><SelectItem value="retail">Retail</SelectItem></SelectContent></Select><ToggleGroup type="single" defaultValue="png" aria-label="File type"><ToggleGroupItem value="png">PNG</ToggleGroupItem><ToggleGroupItem value="jpg">JPG</ToggleGroupItem></ToggleGroup></div>
              <Button type="submit">Save details</Button>
            </form></Form>
          </section>

          <section className="mt-6 rounded-2xl bg-background p-5 shadow-2 sm:p-8">
            <h2 className="text-h2">Navigation and overlays</h2>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Tabs defaultValue="one"><TabsList><TabsTrigger value="one">One</TabsTrigger><TabsTrigger value="two">Two</TabsTrigger></TabsList><TabsContent value="one" className="text-small text-muted-foreground">Selected tab</TabsContent><TabsContent value="two">Second tab</TabsContent></Tabs>
              <Dialog><DialogTrigger asChild><Button variant="secondary">Open dialog</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Export flyer</DialogTitle><DialogDescription>This export uses 1 credit.</DialogDescription></DialogHeader><DialogFooter><Button variant="secondary">Cancel</Button><Button variant="brand">Export flyer</Button></DialogFooter></DialogContent></Dialog>
              <Sheet><SheetTrigger asChild><Button variant="secondary">Open sheet</Button></SheetTrigger><SheetContent side="bottom"><SheetHeader><SheetTitle>Mobile sheet</SheetTitle></SheetHeader><p className="text-small text-muted-foreground">Bottom sheets keep focused tasks close to the thumb.</p></SheetContent></Sheet>
              <Drawer><DrawerTrigger asChild><Button variant="secondary">Open drawer</Button></DrawerTrigger><DrawerContent><DrawerHeader><DrawerTitle>Mobile drawer</DrawerTitle><DrawerDescription>Swipe down to dismiss.</DrawerDescription></DrawerHeader></DrawerContent></Drawer>
              <Popover><PopoverTrigger asChild><Button variant="secondary">Open popover</Button></PopoverTrigger><PopoverContent>Popover content</PopoverContent></Popover>
              <DropdownMenu><DropdownMenuTrigger asChild><Button variant="secondary">Menu</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem><Upload className="mr-2 size-4" /> Upload image</DropdownMenuItem><DropdownMenuItem><Info className="mr-2 size-4" /> View details</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
            </div>
          </section>

          <section className="mt-6 rounded-2xl bg-background p-5 shadow-2 sm:p-8">
            <h2 className="text-h2">Content states</h2>
            <div className="mt-6 flex flex-col gap-4"><Alert><Info className="size-5" /><AlertTitle>Information</AlertTitle><AlertDescription>Your draft is saved on this phone.</AlertDescription></Alert><Alert variant="warning"><CircleAlert className="size-5" /><AlertTitle>Layout warning</AlertTitle><AlertDescription>Your headline may be difficult to fit.</AlertDescription></Alert><Alert variant="success"><Check className="size-5" /><AlertTitle>Saved</AlertTitle><AlertDescription>Your details are ready.</AlertDescription></Alert></div>
            <Separator className="my-6" />
            <ScrollArea className="h-24 rounded-xl bg-surface p-4"><p className="text-small">Scrollable content remains accessible and uses a quiet surface. This area stands in for long menus and list states.</p></ScrollArea>
            <Table className="mt-6"><TableHeader><TableRow><TableHead>Flyer</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>Solar sale</TableCell><TableCell><Badge variant="success">Exported</Badge></TableCell></TableRow></TableBody></Table>
          </section>
        </div>
      </main>
    </TooltipProvider>
  );
}
