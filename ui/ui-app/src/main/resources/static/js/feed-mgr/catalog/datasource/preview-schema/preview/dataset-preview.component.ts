import * as _ from "underscore";
import {Component, Input, OnInit} from "@angular/core";
import {DatasetPreviewDialogComponent, DatasetPreviewDialogData} from "../preview-dialog/dataset-preview-dialog.component";
import {FormGroup} from "@angular/forms";
import {TdDialogService} from "@covalent/core/dialogs";
import {MatDialogConfig, MatTabChangeEvent} from "@angular/material";
import {PreviewFileDataSet} from "../model/preview-file-data-set";
import {PreviewDataSet} from "../model/preview-data-set";
import {TdLoadingService} from "@covalent/core/loading";
import {DatasetPreviewService} from "../service/dataset-preview.service";
import {CatalogService} from '../../../api/services/catalog.service';
import {DatasetService} from '../dataset/dataset-service';
import {SparkDataSet} from '../../../../model/spark-data-set.model';
import {Observable} from 'rxjs/Observable';
import {ItemSaveResponse} from '../../../../shared/info-item/item-save-response';
import {DatasetSaveResponse} from '../dataset/dataset-info/dataset-save-response';
import {StateService} from '@uirouter/core';
import {DescriptionChangeEvent} from '../dataset-simple-table.component';
import {TableColumn} from '../model/table-view-model';


@Component({
    selector: "dataset-preview",
    styleUrls:["./dataset-preview.component.scss"],
    templateUrl: "./dataset-preview.component.html"
})
export class DatasetPreviewComponent implements OnInit{

    @Input()
    displayTitle?:boolean = true;

    @Input()
    dataset:PreviewDataSet

    @Input()
    formGroup:FormGroup;



    rawReady:boolean = false;

    constructor(private _dialogService: TdDialogService,
                private _loadingService:TdLoadingService,
                private _datasetPreviewService:DatasetPreviewService,
                private _catalogService: CatalogService,
                private _datasetService: DatasetService,
                private _stateService: StateService) {

    }
    ngOnInit(){
    }

    createDataset() {
        this._catalogService.createDataSetWithTitle(this.dataset.toSparkDataSet()).subscribe((value) => {
            this.dataset.id = value.id;
        }, error => {
            console.error("Failed to create new dataset", error);
        });
    }

    deleteDataset() {
        this._catalogService.deleteDataset(this.dataset.id).subscribe(() => {
            this.dataset.id = undefined;
        }, error => {
            console.error("Failed to delete new dataset", error);
        });
    }

    onTabChange($event:MatTabChangeEvent){
        //load Raw data if its not there
        if($event.tab.textLabel.toLowerCase() == "raw"){
            if(this.dataset.hasRaw()){
                this.rawReady = true;
                this.dataset.rawLoading = false;
            }
            if(this.dataset instanceof PreviewFileDataSet) {
                if (!this.dataset.hasRaw() && !this.dataset.hasRawError()) {
                    this._datasetPreviewService.notifyToUpdateView();
                    this.dataset.rawLoading = true;
                    this._datasetPreviewService.previewAsTextOrBinary(<PreviewFileDataSet>this.dataset,false,true).subscribe((ds: PreviewDataSet) => {
                        this.rawReady = true;
                        this.dataset.rawLoading = false;
                        this._datasetPreviewService.notifyToUpdateView();
                    }, (error1: any) => {
                        this.rawReady = true;
                        this.dataset.rawLoading = false;
                        this._datasetPreviewService.notifyToUpdateView();
                    });
                }
            }else {
                //we shouldnt get here since only files have the RAW data... but just in case
                this.dataset.rawLoading = false;
                this.rawReady = true;
            }
        }
        this._datasetPreviewService.notifyToUpdateView();
    }

    openSchemaParseSettingsDialog(dataset:PreviewDataSet): void {
        if(dataset instanceof PreviewFileDataSet) {
            this._datasetPreviewService.openSchemaParseSettingsDialog(<PreviewFileDataSet>dataset).subscribe((ds:PreviewDataSet) => {
                //reapply the final dataset back to the main one
                dataset.applyPreview(ds,false);
                //this.previewDatasetValid.emit(dataset)
            },(error:PreviewFileDataSet) =>{
                dataset.preview = undefined
                let message = error.message || "Preview error";
                dataset.previewError(message)
                //save the schema parser
                dataset.userModifiedSchemaParser = error.schemaParser
              //  this.previewDatasetInvalid.emit(dataset)
            })
        }
    }




    /**
     * Update the dialog and position it in the center and full screen
     *
     */
    fullscreen(){
        if(this.dataset && this.dataset.preview){
            let dialogConfig:MatDialogConfig = DatasetPreviewDialogComponent.DIALOG_CONFIG()
            let dialogData:DatasetPreviewDialogData = new DatasetPreviewDialogData(this.dataset)
            dialogConfig.data = dialogData;
            this._dialogService.open(DatasetPreviewDialogComponent,dialogConfig);
        }
    }

    onDescriptionChange(event: DescriptionChangeEvent) {
        const tableColumn = _.find(this.dataset.schema, function(tc: TableColumn) {
            return tc.name === event.columnName;
        });
        if (tableColumn) {
            tableColumn.description = event.newDescription;
            this.saveDataset(this.dataset.toSparkDataSet());
        }
    }

    saveDataset(dataset: SparkDataSet): Observable<ItemSaveResponse> {
        const isExistingDataset = dataset.id !== undefined;
        let observable = this._datasetService.saveDataset(dataset);
        observable.subscribe(
            (response: DatasetSaveResponse) => {
                if (response.success) {
                    this.dataset.id = response.dataset.id;
                    // this.onSaveSuccess(response);
                    // this.editing = false;
                    // this.itemInfoService.onSaved(response);
                    if (!isExistingDataset) {
                        this._stateService.go("catalog.datasource.preview",
                            {
                                datasetId: this.dataset.id,
                                datasource: this.dataset.dataSource,
                                displayInCard:true,
                                location: "replace"
                            });
                    }
                } else {
                    // this.onSaveFail(response);
                }
            },
            // error => this.onSaveFail(error)
        );
        return observable;
    }

}