public with sharing class InvoiceService {
    /*
    Getting the credit Notes assigned to a customer
    */
    @AuraEnabled(cacheable=true)
    public static list<Credit_Note__c> getCreditNotes(Id invId) {
        list<Invoice__c> inv = [SELECT id,Customer__c FROM Invoice__c WHERE id=:invId];
        if(inv!=null && inv.size()>0){
            list<Credit_Note__c> CN = [SELECT id,Name,CreatedDate,Amount_Available__c FROM Credit_Note__c WHERE Invoice__r.Customer__c = :inv[0].Customer__c AND Status__c != 'Closed'];
            return CN;
        }else{
            return null;
        }
    }
    /*
    Getting the invoice details for calculations
    */
    @AuraEnabled(cacheable=true)
    public static Invoice__c getInvoice(Id invId) {
        list<Invoice__c> inv = [SELECT id,Name,CreatedDate,Credit_Note_Credits__c,Total_Amount__c,Amount_Due__c FROM Invoice__c WHERE Id = :invId];
        if(inv!=null && inv.size()>0){
            return inv[0];
        }else{
            return null;
        }
    }
    /*
    Saving the credit note assignments and updates invoice and credit notes
    */
    @AuraEnabled
    public static void saveCreditLines(list<invoiceWrapper> wrp, string InvoiceId) {
        List<id> credIds = new list<id>();
        list<Credit_Note_Assignment__c> noteAssignMent = new list<Credit_Note_Assignment__c>();
        for(invoiceWrapper wr: wrp) {
            if(wr.Amount_To_Credit!=null && wr.Amount_To_Credit!=0) {
                Credit_Note_Assignment__c CNA = new Credit_Note_Assignment__c();
                CNA.Invoice__c = InvoiceId;
                CNA.Amount_Allocated__c = wr.Amount_To_Credit;
                CNA.Credit_Note__c = wr.CredId;
                credIds.add(wr.CredId);
                noteAssignMent.add(CNA);
            }
        }
        try {
            INSERT noteAssignMent;
        }catch(exception e){
            system.debug(e);
        }
        
        Invoice__c inv = [SELECT id,Name,CreatedDate,Credit_Note_Credits__c,Total_Amount__c,Status__c FROM Invoice__c WHERE Id = :InvoiceId];
        if(inv.Total_Amount__c == inv.Credit_Note_Credits__c) {
            inv.Status__c = 'Paid';
        }else if(inv.Total_Amount__c > inv.Credit_Note_Credits__c) {
            inv.Status__c = 'Partially Paid';
        }else if( inv.Credit_Note_Credits__c ==0) {
            inv.Status__c = 'Unpaid';
        }
        try {
            UPDATE inv;
        }catch(exception e){
            system.debug(e);
        }
        list<Credit_Note__c> crNotes = new list<Credit_Note__c>();
        for(Credit_Note__c cNote : [SELECT id,Amount_Available__c FROM Credit_Note__c WHERE id IN :credIds]) {
            if(cNote.Amount_Available__c==0) {
                cNote.Status__c = 'Closed';
            }else if(cNote.Amount_Available__c>0) {
                cNote.Status__c = 'Partial';
            }
            crNotes.add(cNote);
        }
        try {
            UPDATE crNotes;
        }catch(exception e){
            system.debug(e);
        }
    }
    /*
    Wrapper to get the values for the JS controller
    */
    public class invoiceWrapper {
        @AuraEnabled public string CredId{get;set;}
        @AuraEnabled public Decimal Amount_To_Credit{get;set;}
    }
}