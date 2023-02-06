import { LightningElement,wire, track ,api} from 'lwc';
import getCreditNotes from '@salesforce/apex/InvoiceService.getCreditNotes';
import getInvoice from '@salesforce/apex/InvoiceService.getInvoice';
import saveCreditLines from '@salesforce/apex/InvoiceService.saveCreditLines';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
export default class DemoLWC extends LightningElement {
    totalCredit = 0;
    rowOffset = 0;
    @track creditNotesData=[];
    @track draftValues;
    invoice;
    @track selectedRows = [];
    @api recordId='a002w00000XoSPOAA3';//Hardcoded for demo purpose. Can be used in app builder to pass the record id

    columns = [
        { label: 'Credit Note', fieldName: 'Name' },
        { label: 'Created Date', fieldName: 'CreatedDate',type:'date' },
        { label: 'Amount Available', fieldName: 'Amount_Available', type: 'currency' },
        { label: 'Amount to Credit', fieldName: 'Amount_To_Credit', type: 'currency',editable: true}
    ];
    @wire(getCreditNotes, {invId:'$recordId'})
    getOpenCreditNotes({ data, error }) {  
        if (data) {
            let creditNotesData=[];
            data.forEach(elm => {
                if(elm) {
                    let creditNoteObject = {CredId:elm.Id,Name:elm.Name,CreatedDate:elm.CreatedDate,Amount_Available:elm.Amount_Available__c,Amount_To_Credit:0};
                    creditNotesData.push(creditNoteObject)
                }
            });
            this.creditNotesData = creditNotesData;
        } else if (error) {
            console.log('check error here', error);
        }
    }
    validateRows() {
        let changedRow =this.template.querySelector('lightning-datatable').draftValues;
        this.totalCredit = 0;
        let creditNotesData = this.creditNotesData;
        let selectedRows = [];
        creditNotesData.forEach(elm => {
            changedRow.forEach(row => {
                if(elm.CredId==row.CredId){
                    if(elm.Amount_Available__c<row.Amount_To_Credit) {
                        const evt = new ShowToastEvent({
                            title: '',
                            message: elm.Name+' amount exceeded the available limit '+elm.Amount_Available__c,
                            variant: 'error',
                        });
                        this.dispatchEvent(evt);
                        row.Amount_To_Credit = elm.Amount_Available__c;
                        selectedRows.push(elm.CredId);
                        this.totalCredit+=parseInt(row.Amount_To_Credit);
                    }else if(row.Amount_To_Credit!=elm.Amount_To_Credit) {
                        selectedRows.push(elm.CredId);
                        this.totalCredit+=parseInt(row.Amount_To_Credit);
                    }
                }
            });
        });
        this.selectedRows = selectedRows;
        
        this.draftValues = changedRow;
    }
    @wire(getInvoice, {invId:'$recordId'})
    getInvoiceDetails({ data, error }) {  
        if (data) {
            this.invoice = data;
        } else if (error) {
            console.log('check error here', error);
        }
    }
    get remainAmount() {
        if(this.invoice){
            let moneyLeft = this.invoice.Amount_Due__c - this.totalCredit;
            if(moneyLeft<0) {
                const evt = new ShowToastEvent({
                title: '',
                message: 'The total credit exceeded the invoice amount.',
                variant: 'error',
                });
                this.dispatchEvent(evt);
                return null;
            }else{
                return moneyLeft;
            }
        }else{
            return null;
        }
    }

    handleSave() {
        let credLines = [];
        let selectedRows =this.template.querySelector('lightning-datatable').selectedRows;
        let changedRow =this.template.querySelector('lightning-datatable').draftValues;
        changedRow.forEach(row => {
            if(selectedRows.includes(row.CredId)) {
            console.log(JSON.stringify(row));
                credLines.push(row);
            }
        });
        let a = this.invoice.Total_Amount__c - this.totalCredit;
        if(a<0) {
            const evt = new ShowToastEvent({
            title: '',
            message: 'The total credit exceeded the invoice amount.',
            variant: 'error',
            });
            this.dispatchEvent(evt);
            return false;
        }
        console.log(JSON.stringify(credLines));
        saveCreditLines({wrp: credLines, InvoiceId : 'a002w00000XoSPOAA3'})
            .then(data => {
                const evt = new ShowToastEvent({
                    title: '',
                    message: 'Credit Notes have been allocated successfully to the invoice',
                    variant: 'success',
                });
                this.dispatchEvent(evt);
                setTimeout(window.location.reload(), 5000);

            }).catch(error => {
                const evt = new ShowToastEvent({
                    title: '',
                    message: error.error,
                    variant: 'error',
                });
                this.dispatchEvent(evt);
            });
        this.totalCredit = 0;
    }
}