import static com.sap.piper.internal.Prerequisites.checkScript

void call(Map params) {

  echo "do acceptance stage"
  params.originalStage()

}
return this
